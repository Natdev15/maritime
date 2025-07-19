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
   * @param {string} url - The target endpoint URL
   * @param {Array} containerData - The decompressed container data array
   * @param {Object} metadata - Additional metadata
   */
  async forwardDecompressedData(url, containerData, metadata = {}) {
    try {
      console.log(`📨 Forwarding decompressed data to: ${url}`);
      console.log(`📊 Containers: ${containerData.length}`);
      
      const payload = {
        containers: containerData,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          sourceNode: 'slave',
          containerCount: containerData.length,
          processedAt: new Date().toISOString()
        }
      };

      const payloadSize = JSON.stringify(payload).length;
      console.log(`📊 Payload size: ${this.formatBytes(payloadSize)}`);

      const response = await this.client.post(url, payload);
      
      console.log(`✅ Successfully forwarded decompressed data`);
      return {
        success: true,
        response: response.data,
        forwardedContainers: containerData.length,
        payloadSize,
        responseStatus: response.status
      };

    } catch (error) {
      console.error(`❌ Failed to forward decompressed data:`, error.message);
      
      return {
        success: false,
        error: error.message,
        responseStatus: error.response?.status || null,
        forwardedContainers: containerData.length
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