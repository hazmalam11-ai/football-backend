// services/timezoneService.js
const axios = require("axios");

class TimezoneService {
  constructor() {
    this.ipApiUrl = "http://ip-api.com/json";
    this.timezoneCache = new Map();
  }

  // Get timezone from IP address
  async getTimezoneFromIP(ip) {
    try {
      // Check cache first
      if (this.timezoneCache.has(ip)) {
        return this.timezoneCache.get(ip);
      }

      // Handle localhost/development IPs
      if (this.isLocalhost(ip)) {
        console.log(`🏠 Localhost detected: ${ip}, using Africa/Cairo for Egypt`);
        const timezone = 'Africa/Cairo';
        this.timezoneCache.set(ip, timezone);
        return timezone;
      }

      console.log(`🌍 Detecting timezone for IP: ${ip}`);
      
      const response = await axios.get(`${this.ipApiUrl}/${ip}`, {
        timeout: 5000,
        headers: {
          'User-Agent': 'SportsApp/1.0'
        }
      });

      const data = response.data;
      
      if (data.status === 'success') {
        const timezone = data.timezone;
        console.log(`✅ Timezone detected: ${timezone} for ${data.city}, ${data.country}`);
        
        // Cache the result
        this.timezoneCache.set(ip, timezone);
        
        return timezone;
      } else {
        console.log(`⚠️ Failed to detect timezone for IP: ${ip}, using Africa/Cairo for Egypt`);
        return 'Africa/Cairo';
      }
    } catch (error) {
      console.error(`❌ Error detecting timezone for IP ${ip}:`, error.message);
      return 'Africa/Cairo';
    }
  }

  // Check if IP is localhost/development
  isLocalhost(ip) {
    const localhostIPs = [
      '::1', '127.0.0.1', 'localhost',
      '::ffff:127.0.0.1', '0:0:0:0:0:0:0:1'
    ];
    return localhostIPs.includes(ip) || this.isLocalNetwork(ip);
  }

  // Get user's IP from request
  getUserIP(req) {
    // Try to get real public IP from various headers first
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIP = req.headers['x-real-ip'];
    const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
    const xClientIP = req.headers['x-client-ip'];
    
    // Check for public IP in headers (not local network)
    const headerIPs = [forwardedFor, realIP, cfConnectingIP, xClientIP]
      .filter(Boolean)
      .flatMap(ip => ip.split(','))
      .map(ip => ip.trim())
      .find(ip => !this.isLocalNetwork(ip));
    
    if (headerIPs) {
      console.log(`🌐 Found public IP in headers: ${headerIPs}`);
      return headerIPs;
    }
    
    // Fallback to request IP
    const requestIP = req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null);
    
    // If it's a local network IP, try to get public IP from external service
    if (this.isLocalNetwork(requestIP)) {
      console.log(`🏠 Local network IP detected: ${requestIP}, will fetch public IP`);
      return null; // Signal to fetch public IP
    }
    
    return requestIP || '127.0.0.1';
  }

  // Check if IP is local network (private IP ranges)
  isLocalNetwork(ip) {
    if (!ip) return true;
    
    // Remove IPv6 prefix if present
    const cleanIP = ip.replace('::ffff:', '');
    
    return cleanIP.startsWith('192.168.') || 
           cleanIP.startsWith('10.') || 
           cleanIP.startsWith('172.') ||
           cleanIP === '127.0.0.1' ||
           cleanIP === '::1' ||
           cleanIP === 'localhost';
  }

  // Get timezone with fallback options
  async getTimezone(req) {
    try {
      // 1. Try to get from query parameter first (manual override)
      if (req.query.timezone) {
        console.log(`🌍 Using timezone from query: ${req.query.timezone}`);
        return req.query.timezone;
      }

      // 2. Try to get from user's IP
      let userIP = this.getUserIP(req);
      console.log(`📍 Initial userIP: ${userIP}`);
      
      // If we got null (local network), fetch public IP
      if (!userIP) {
        console.log(`🌐 Fetching public IP from external service...`);
        try {
          const publicIPResponse = await axios.get('https://api.ipify.org?format=json', { timeout: 5000 });
          userIP = publicIPResponse.data.ip;
          console.log(`🌐 Public IP detected: ${userIP}`);
        } catch (error) {
          console.log(`⚠️ Could not fetch public IP: ${error.message}, using local IP detection`);
          userIP = req.ip || '127.0.0.1';
        }
      }
      
      console.log(`📍 Final userIP for timezone detection: ${userIP}`);
      
      const timezone = await this.getTimezoneFromIP(userIP);
      
      return timezone;
    } catch (error) {
      console.error('❌ Error getting timezone:', error.message);
      return 'Africa/Cairo'; // Default to Egypt timezone
    }
  }

  // Validate timezone
  isValidTimezone(timezone) {
    const validTimezones = Object.keys(this.getCommonTimezones());
    return validTimezones.includes(timezone);
  }

  // Get common timezones for different regions
  getCommonTimezones() {
    return {
      'Africa/Cairo': 'Cairo (EET) - Egypt',
      'Asia/Dubai': 'Dubai (GST) - UAE',
      'Asia/Riyadh': 'Riyadh (AST) - Saudi Arabia',
      'Asia/Kuwait': 'Kuwait (AST)',
      'Asia/Qatar': 'Doha (AST) - Qatar',
      'Asia/Bahrain': 'Manama (AST) - Bahrain',
      'Asia/Muscat': 'Muscat (GST) - Oman',
      'Asia/Tehran': 'Tehran (IRST) - Iran',
      'Asia/Jerusalem': 'Jerusalem (IST) - Israel',
      'Europe/London': 'London (GMT/BST)',
      'Europe/Paris': 'Paris (CET/CEST)',
      'Europe/Berlin': 'Berlin (CET/CEST)',
      'America/New_York': 'Eastern Time (US)',
      'America/Chicago': 'Central Time (US)',
      'America/Los_Angeles': 'Pacific Time (US)',
      'Asia/Tokyo': 'Tokyo (JST)',
      'Asia/Shanghai': 'Shanghai (CST)',
      'Australia/Sydney': 'Sydney (AEST/AEDT)',
      'UTC': 'UTC (Coordinated Universal Time)'
    };
  }
}

module.exports = new TimezoneService();
