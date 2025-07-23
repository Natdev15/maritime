const axios = require('axios');

/**
 * HTTP Client for master-slave communication
 * Handles sending compressed data and forwarding decompressed data
 */
class HttpClient {
  constructor() {
    // Configure axios with reasonable timeouts and retry behavior
    this.client = axios.create({
      timeout: 300000, // 5 minutes timeout for large compressed data
      maxContentLength: 100 * 1024 * 1024, // 100MB max
      maxBodyLength: 100 * 1024 * 1024, // 100MB max
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Maritime-Container-Tracker/1.0'
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🌐 HTTP ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ Request interceptor error:', error.message);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ HTTP ${response.status} ${response.config.url} (${this.formatBytes(JSON.stringify(response.data).length)})`);
        return response;
      },
      (error) => {
        const status = error.response?.status || 'NETWORK_ERROR';
        const url = error.config?.url || 'unknown';
        console.error(`❌ HTTP ${status} ${url} - ${error.message}`);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Send compressed data to slave endpoint (master mode)
   * @param {string} url - The slave endpoint URL
   * @param {Buffer} compressedData - The compressed container data
   * @param {Object} metadata - Additional metadata about the compression
   */
  async sendCompressedData(url, compressedData, metadata = {}) {
    try {
      console.log(`📤 Sending compressed data to slave: ${url}`);
      console.log(`📊 Data size: ${this.formatBytes(compressedData.length)}`);
      
      const payload = {
        compressedData: compressedData.toString('base64'), // Convert buffer to base64
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          sourceNode: 'master',
          compressionType: 'brotli',
          originalSize: metadata.originalSize || null,
          compressionRatio: metadata.compressionRatio || null
        }
      };

      const response = await this.client.post(url, payload);
      
      console.log(`✅ Successfully sent compressed data to slave`);
      return {
        success: true,
        response: response.data,
        sentBytes: compressedData.length,
        responseStatus: response.status
      };

    } catch (error) {
      console.error(`❌ Failed to send compressed data to slave:`, error.message);
      
      return {
        success: false,
        error: error.message,
        responseStatus: error.response?.status || null,
        sentBytes: compressedData.length
      };
    }
  }

  /**
   * Forward decompressed data to another endpoint (slave mode)
   * Each container is sent individually in parallel using M2M format
   * @param {string} url - The target endpoint URL
   * @param {Array} containerData - The decompressed container data array
   * @param {Object} metadata - Additional metadata
   */
  async forwardDecompressedData(url, containerData, metadata = {}) {
    const maxRetries = 3;
    const baseDelay = 500; // ms
    try {
      console.log(`📨 Forwarding decompressed data to: ${url}`);
      console.log(`📊 Containers: ${containerData.length} (sending in parallel)`);
      const startTime = Date.now();
      // Send each container individually in parallel
      const forwardPromises = containerData.map(async (container, index) => {
        let attempt = 0;
        let lastError = null;
        let responseStatus = null;
        const containerId = container.containerId || container.id;
        while (attempt <= maxRetries) {
          try {
            const timestamp = container.data?.timestamp || container.timestamp || new Date().toISOString();
            const payload = {
              "m2m:cin": {
                "con": container.data || container
              }
            };
            const response = await this.client.post(url, payload, {
              headers: {
                'Content-Type': 'application/json;ty=4',
                'X-M2M-RI': timestamp,
                'X-M2M-ORIGIN': 'Natesh'
              }
            });
            responseStatus = response.status;
            // Treat 2xx and 409 as success
            if (response.status >= 200 && response.status < 300) {
              console.log(`✅ Container ${index + 1}/${containerData.length} forwarded (ID: ${containerId})`);
              return {
                success: true,
                containerId,
                responseStatus: response.status,
                index
              };
            }
          } catch (error) {
            responseStatus = error.response?.status || null;
            lastError = error;
            // Treat 409 as idempotent success
            if (responseStatus === 409) {
              console.log(`⚠️  Container ${index + 1}/${containerData.length} already exists (ID: ${containerId}) - treating as success`);
              return {
                success: true,
                containerId,
                responseStatus: 409,
                index,
                alreadyExists: true
              };
            }
            // Retry only on network/5xx errors
            if (!responseStatus || (responseStatus >= 500 && responseStatus < 600)) {
              attempt++;
              if (attempt > maxRetries) break;
              const delay = baseDelay * Math.pow(2, attempt - 1);
              console.log(`🔁 Retry ${attempt} for container ${containerId} after ${delay}ms (error: ${error.message})`);
              await new Promise(res => setTimeout(res, delay));
              continue;
            } else {
              // For 4xx (except 409), do not retry
              break;
            }
          }
        }
        console.error(`❌ Failed to forward container ${index + 1}: ${lastError ? lastError.message : 'Unknown error'}`);
        return {
          success: false,
          containerId,
          error: lastError ? lastError.message : 'Unknown error',
          responseStatus,
          index
        };
      });
      // Wait for all parallel requests to complete
      const results = await Promise.all(forwardPromises);
      // Calculate success/failure statistics
      const successful = results.filter(r => r.success);
      // Only count as failed if not success (409s are success)
      const failed = results.filter(r => !r.success);
      const alreadyExists = results.filter(r => r.alreadyExists);
      const processingTime = Date.now() - startTime;
      console.log(`✅ Forwarding completed in ${processingTime}ms:`);
      console.log(`   📊 Successful: ${successful.length}/${containerData.length}`);
      if (alreadyExists.length > 0) {
        console.log(`   ⚠️  Already exists (409, treated as success): ${alreadyExists.length}`);
      }
      if (failed.length > 0) {
        console.log(`   ❌ Failed: ${failed.length}/${containerData.length}`);
        failed.slice(0, 3).forEach(failure => {
          console.log(`      - Container ${failure.containerId}: ${failure.error}`);
        });
        if (failed.length > 3) {
          console.log(`      - ... and ${failed.length - 3} more failures`);
        }
      }
      return {
        success: failed.length === 0, // Success only if all containers were forwarded or already existed
        response: {
          totalContainers: containerData.length,
          successfulForwards: successful.length,
          alreadyExists: alreadyExists.length,
          failedForwards: failed.length,
          processingTimeMs: processingTime,
          results: results
        },
        forwardedContainers: successful.length,
        alreadyExistsContainers: alreadyExists.map(a => a.containerId),
        failedContainers: failed.map(f => f.containerId),
        payloadSize: JSON.stringify(containerData).length, // Original payload size
        responseStatus: failed.length === 0 ? 200 : 207, // 207 for partial success
        metadata: {
          ...metadata,
          parallelRequests: true,
          m2mFormat: true,
          forwardingStrategy: 'individual-parallel'
        }
      };
    } catch (error) {
      console.error(`❌ Failed to forward decompressed data:`, error.message);
      return {
        success: false,
        error: error.message,
        responseStatus: error.response?.status || null,
        forwardedContainers: 0
      };
    }
  }

  /**
   * Test connectivity to a remote endpoint
   * @param {string} url - The endpoint URL to test
   */
  async testConnectivity(url) {
    try {
      console.log(`🔍 Testing connectivity to: ${url}`);
      
      // Try a simple GET request to the base URL
      const testUrl = new URL(url);
      const baseUrl = `${testUrl.protocol}//${testUrl.host}`;
      
      const response = await this.client.get(baseUrl, { timeout: 10000 });
      
      console.log(`✅ Connectivity test successful: ${response.status}`);
      return {
        success: true,
        status: response.status,
        url: baseUrl
      };

    } catch (error) {
      console.error(`❌ Connectivity test failed:`, error.message);
      
      return {
        success: false,
        error: error.message,
        url
      };
    }
  }

  /**
   * Send health check ping
   * @param {string} url - The endpoint URL
   */
  async sendHealthCheck(url) {
    try {
      const healthUrl = new URL('/api/health', url).toString();
      const response = await this.client.get(healthUrl, { timeout: 5000 });
      
      return {
        success: true,
        status: response.status,
        data: response.data
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status || null
      };
    }
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get client statistics
   */
  getStats() {
    return {
      timeout: this.client.defaults.timeout,
      maxContentLength: this.client.defaults.maxContentLength,
      userAgent: this.client.defaults.headers['User-Agent']
    };
  }
}

module.exports = HttpClient; 