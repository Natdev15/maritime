/**
 * Configuration management for master-slave architecture
 * Handles environment variables and mode validation
 */
class Config {
  constructor() {
    this.nodeType = process.env.NODE_TYPE;
    this.port = parseInt(process.env.PORT) || 3000;
    this.sendToUrl = process.env.SEND_TO_URL;
    this.forwardToUrl = process.env.FORWARD_TO_URL;
    
    // Validate configuration on startup
    this.validateConfig();
  }

  /**
   * Validate environment configuration
   */
  validateConfig() {
    // Validate node type
    if (!this.nodeType || !['master', 'slave'].includes(this.nodeType)) {
      this.throwConfigurationError(
        'NODE_TYPE environment variable is missing or invalid',
        'NODE_TYPE must be set to either "master" or "slave"',
        [
          'For Master Node (collects data from remote locations):',
          '  NODE_TYPE=master',
          '  SEND_TO_URL=http://slave-server:3000/api/receive-compressed',
          '',
          'For Slave Node (receives and forwards data):',
          '  NODE_TYPE=slave', 
          '  FORWARD_TO_URL=http://data-center:8080/api/containers/bulk'
        ]
      );
    }

    // Validate master mode requirements
    if (this.isMaster()) {
      if (!this.sendToUrl) {
        this.throwConfigurationError(
          'SEND_TO_URL environment variable is required in master mode',
          'Master nodes must specify where to send compressed data',
          [
            'Set the SEND_TO_URL environment variable:',
            '  SEND_TO_URL=http://slave-server:3000/api/receive-compressed',
            '',
            'Example master configuration:',
            '  NODE_TYPE=master',
            '  SEND_TO_URL=https://datacenter.maritime.com:3000/api/receive-compressed',
            '  COMPRESSION_SCHEDULE_HOURS=6',
            '  PORT=3000'
          ]
        );
      }
      if (this.forwardToUrl) {
        console.warn('WARNING: FORWARD_TO_URL is set in master mode but will be ignored');
      }
      if (!this.isValidUrl(this.sendToUrl)) {
        this.throwConfigurationError(
          'SEND_TO_URL must be a valid HTTP/HTTPS URL',
          `Invalid URL: ${this.sendToUrl}`,
          [
            'SEND_TO_URL must be a complete URL with protocol:',
            '  ✅ http://slave-server:3000/api/receive-compressed',
            '  ✅ https://datacenter.maritime.com:3000/api/receive-compressed',
            '  ❌ slave-server:3000/api/receive-compressed',
            '  ❌ slave-server'
          ]
        );
      }
    }

    // Validate slave mode requirements
    if (this.isSlave()) {
      if (!this.forwardToUrl) {
        this.throwConfigurationError(
          'FORWARD_TO_URL environment variable is required in slave mode',
          'Slave nodes must specify where to forward decompressed data',
          [
            'Set the FORWARD_TO_URL environment variable:',
            '  FORWARD_TO_URL=http://data-center:8080/api/containers/bulk',
            '',
            'Example slave configuration:',
            '  NODE_TYPE=slave',
            '  FORWARD_TO_URL=https://analytics.maritime.com:8080/api/container-data',
            '  PORT=3000'
          ]
        );
      }
      if (this.sendToUrl) {
        console.warn('WARNING: SEND_TO_URL is set in slave mode but will be ignored');
      }
      if (!this.isValidUrl(this.forwardToUrl)) {
        this.throwConfigurationError(
          'FORWARD_TO_URL must be a valid HTTP/HTTPS URL',
          `Invalid URL: ${this.forwardToUrl}`,
          [
            'FORWARD_TO_URL must be a complete URL with protocol:',
            '  ✅ http://data-center:8080/api/containers/bulk',
            '  ✅ https://analytics.maritime.com:8080/api/container-data',
            '  ❌ data-center:8080/api/containers/bulk',
            '  ❌ data-center'
          ]
        );
      }
    }

    console.log(`🔧 Configuration validated: ${this.nodeType} mode`);
    if (this.isMaster()) {
      console.log(`📤 Will send data to: ${this.sendToUrl}`);
    }
    if (this.isSlave()) {
      console.log(`📨 Will forward data to: ${this.forwardToUrl}`);
    }
  }

  /**
   * Throw a detailed configuration error with setup instructions
   */
  throwConfigurationError(title, description, instructions = []) {
    const errorMessage = [
      '',
      '🚢 Maritime Container Tracker - Configuration Error',
      '='.repeat(60),
      '',
      `❌ ${title}`,
      '',
      `📋 ${description}`,
      '',
      '🔧 Setup Instructions:',
      ...instructions.map(line => `   ${line}`),
      '',
      '📖 For more details, see: README.md',
      '',
      '='.repeat(60),
      ''
    ].join('\n');

    throw new Error(errorMessage);
  }

  /**
   * Check if URL is valid
   */
  isValidUrl(urlString) {
    try {
      const url = new URL(urlString);
      return ['http:', 'https:'].includes(url.protocol);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if running in master mode
   */
  isMaster() {
    return this.nodeType === 'master';
  }

  /**
   * Check if running in slave mode
   */
  isSlave() {
    return this.nodeType === 'slave';
  }

  /**
   * Get send URL for master mode
   */
  getSendToUrl() {
    if (!this.isMaster()) {
      throw new Error('getSendToUrl() can only be called in master mode');
    }
    return this.sendToUrl;
  }

  /**
   * Get forward URL for slave mode
   */
  getForwardToUrl() {
    if (!this.isSlave()) {
      throw new Error('getForwardToUrl() can only be called in slave mode');
    }
    
    // Fix double http:// prefix issue
    let url = this.forwardToUrl;
    if (url && url.startsWith('http://http://')) {
      url = url.replace('http://http://', 'http://');
    } else if (url && url.startsWith('https://https://')) {
      url = url.replace('https://https://', 'https://');
    }
    
    return url;
  }

  /**
   * Get configuration summary
   */
  getSummary() {
    return {
      nodeType: this.nodeType,
      port: this.port,
      isMaster: this.isMaster(),
      isSlave: this.isSlave(),
      sendToUrl: this.isMaster() ? this.sendToUrl : null,
      forwardToUrl: this.isSlave() ? this.forwardToUrl : null
    };
  }
}

module.exports = Config;