const { Client } = require('ssh2');
const EventEmitter = require('events');

class SSHManager extends EventEmitter {
  constructor(credentials) {
    super();
    this.credentials = credentials;
    this.client = new Client();
    this.stream = null;
    this.connected = false;
    this.keepAliveInterval = null;
    
    this.setupClientEvents();
  }
  
  setupClientEvents() {
    this.client.on('ready', () => {
      console.log('SSH Client :: ready');
      this.connected = true;
      
      // Start an interactive shell session
      this.client.shell((err, stream) => {
        if (err) {
          this.emit('error', err);
          return;
        }
        
        this.stream = stream;
        
        // Set up stream event handlers
        stream.on('close', () => {
          console.log('SSH Stream :: close');
          this.connected = false;
          this.cleanup();
          this.emit('close');
        });
        
        stream.on('data', (data) => {
          this.emit('data', data);
        });
        
        stream.stderr.on('data', (data) => {
          this.emit('data', data);
        });
        
        // Start keep-alive mechanism
        this.startKeepAlive();
        
        this.emit('ready');
      });
    });
    
    this.client.on('error', (err) => {
      console.error('SSH Client :: error:', err);
      this.connected = false;
      this.cleanup();
      this.emit('error', err);
    });
    
    this.client.on('end', () => {
      console.log('SSH Client :: end');
      this.connected = false;
      this.cleanup();
      this.emit('close');
    });
    
    this.client.on('close', () => {
      console.log('SSH Client :: close');
      this.connected = false;
      this.cleanup();
      this.emit('close');
    });
  }
  
  connect() {
    const config = {
      host: this.credentials.host,
      port: this.credentials.port || 22,
      username: this.credentials.username,
      password: this.credentials.password,
      // Keep-alive settings
      keepaliveInterval: 30000, // 30 seconds
      keepaliveCountMax: 3,
      readyTimeout: 20000,
      // Additional options for stability
      algorithms: {
        cipher: ['aes128-gcm', 'aes128-ctr', 'aes192-ctr', 'aes256-ctr'],
        hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1'],
        kex: ['diffie-hellman-group-exchange-sha256', 'ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521'],
        serverHostKey: ['rsa-sha2-512', 'rsa-sha2-256', 'ssh-rsa', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521']
      }
    };
    
    // Support for private key authentication
    if (this.credentials.privateKey) {
      config.privateKey = this.credentials.privateKey;
      delete config.password;
    }
    
    console.log(`Connecting to SSH: ${config.username}@${config.host}:${config.port}`);
    this.client.connect(config);
  }
  
  write(data) {
    if (this.stream && this.connected) {
      this.stream.write(data);
    }
  }
  
  resize(cols, rows) {
    if (this.stream && this.connected) {
      this.stream.setWindow(rows, cols);
    }
  }
  
  isConnected() {
    return this.connected;
  }
  
  startKeepAlive() {
    // Send a keep-alive command every 60 seconds
    this.keepAliveInterval = setInterval(() => {
      if (this.connected && this.stream) {
        // Send a harmless command to keep the connection alive
        // Using echo with empty string - won't interfere with user commands
        this.stream.write('\0'); // Send null byte as keep-alive
      }
    }, 60000); // 60 seconds
  }
  
  stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
  
  disconnect() {
    console.log('Disconnecting SSH session...');
    this.connected = false;
    this.cleanup();
    
    if (this.client) {
      this.client.end();
    }
  }
  
  cleanup() {
    this.stopKeepAlive();
    
    if (this.stream) {
      this.stream.removeAllListeners();
      this.stream = null;
    }
  }
  
  // Method to execute a single command (optional - for utility)
  exec(command, callback) {
    if (!this.connected) {
      return callback(new Error('SSH not connected'));
    }
    
    this.client.exec(command, (err, stream) => {
      if (err) return callback(err);
      
      let output = '';
      let errorOutput = '';
      
      stream.on('close', (code, signal) => {
        callback(null, { output, errorOutput, code, signal });
      });
      
      stream.on('data', (data) => {
        output += data.toString();
      });
      
      stream.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
    });
  }
}

module.exports = SSHManager;
