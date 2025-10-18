// Network Statistics and Debug Overlay
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.NetworkDebug = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    class NetworkStats {
        constructor() {
            this.stats = {
                ping: 0,
                packetLoss: 0,
                jitter: 0,
                bandwidthUp: 0,
                bandwidthDown: 0,
                entityCount: 0,
                updateFrequency: 0,
                interpolationBuffer: 0,
                serverTickRate: 0,
                clientFrameRate: 0,
                lastUpdate: Date.now(),
                packetCount: 0,
                bytesReceived: 0,
                bytesSent: 0,
                connectionTime: Date.now(),
                predictionError: 0,
                avgPredictionError: 0,
                maxPredictionError: 0,
                correctionCount: 0
            };
            
            this.pingHistory = [];
            this.packetHistory = [];
            this.maxHistorySize = 100;
            
            this.overlay = null;
            this.enabled = false;
        }

        start() {
            this.enabled = true;
            this.createOverlay();
            this.startMonitoring();
        }

        stop() {
            this.enabled = false;
            if (this.overlay) {
                this.overlay.remove();
                this.overlay = null;
            }
        }

        createOverlay() {
            this.overlay = document.createElement('div');
            this.overlay.id = 'network-debug-overlay';
            this.overlay.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: #00ff00;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                padding: 10px;
                border: 1px solid #00ff00;
                border-radius: 5px;
                z-index: 10000;
                min-width: 250px;
                line-height: 1.4;
            `;
            document.body.appendChild(this.overlay);
        }

        updateStats(data) {
            if (!this.enabled) return;
            
            this.stats = { ...this.stats, ...data };
            this.stats.lastUpdate = Date.now();
            
            if (data.ping !== undefined) {
                this.pingHistory.push(data.ping);
                if (this.pingHistory.length > this.maxHistorySize) {
                    this.pingHistory.shift();
                }
                this.stats.jitter = this.calculateJitter();
            }
            
            this.updateDisplay();
        }

        calculateJitter() {
            if (this.pingHistory.length < 2) return 0;
            
            let jitter = 0;
            for (let i = 1; i < this.pingHistory.length; i++) {
                jitter += Math.abs(this.pingHistory[i] - this.pingHistory[i - 1]);
            }
            return jitter / (this.pingHistory.length - 1);
        }

        recordPacket(size, direction = 'down') {
            if (!this.enabled) return;
            
            this.packetHistory.push({
                time: Date.now(),
                size: size,
                direction: direction
            });
            
            if (this.packetHistory.length > this.maxHistorySize) {
                this.packetHistory.shift();
            }
            
            if (direction === 'down') {
                this.stats.bytesReceived += size;
            } else {
                this.stats.bytesSent += size;
            }
            
            this.stats.packetCount++;
        }

        startMonitoring() {
            if (!this.enabled) return;
            
            setInterval(() => {
                this.updateBandwidthStats();
                this.updateDisplay();
            }, 1000);
        }

        updateBandwidthStats() {
            const now = Date.now();
            const oneSecondAgo = now - 1000;
            
            const recentPackets = this.packetHistory.filter(p => p.time > oneSecondAgo);
            
            this.stats.bandwidthDown = recentPackets
                .filter(p => p.direction === 'down')
                .reduce((sum, p) => sum + p.size, 0);
                
            this.stats.bandwidthUp = recentPackets
                .filter(p => p.direction === 'up')
                .reduce((sum, p) => sum + p.size, 0);
        }

        updateDisplay() {
            if (!this.overlay) return;
            
            const uptime = Math.floor((Date.now() - this.stats.connectionTime) / 1000);
            const uptimeStr = `${Math.floor(uptime / 60)}:${(uptime % 60).toString().padStart(2, '0')}`;
            
            // Color code prediction error
            let errorColor = '#00ff00'; // green
            if (this.stats.predictionError > 30) errorColor = '#ff0000'; // red
            else if (this.stats.predictionError > 10) errorColor = '#ffff00'; // yellow
            
            this.overlay.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 5px; color: #ffff00;">Network Debug</div>
                <div>Ping: ${this.stats.ping.toFixed(1)}ms</div>
                <div>Jitter: ${this.stats.jitter.toFixed(1)}ms</div>
                <div>Packet Loss: ${this.stats.packetLoss.toFixed(1)}%</div>
                <div>Bandwidth ↓: ${(this.stats.bandwidthDown / 1024).toFixed(1)} KB/s</div>
                <div>Bandwidth ↑: ${(this.stats.bandwidthUp / 1024).toFixed(1)} KB/s</div>
                <div>Entities: ${this.stats.entityCount}</div>
                <div>Update Rate: ${this.stats.updateFrequency.toFixed(1)} Hz</div>
                <div>Server FPS: ${this.stats.serverTickRate.toFixed(1)}</div>
                <div>Client FPS: ${this.stats.clientFrameRate.toFixed(1)}</div>
                <div>Packets: ${this.stats.packetCount}</div>
                <div style="margin-top: 5px; border-top: 1px solid #444; padding-top: 5px;">
                    <div style="font-weight: bold; color: #ffff00;">Prediction</div>
                    <div style="color: ${errorColor};">Error: ${this.stats.predictionError.toFixed(1)}px</div>
                    <div>Avg: ${this.stats.avgPredictionError.toFixed(1)}px</div>
                    <div>Max: ${this.stats.maxPredictionError.toFixed(1)}px</div>
                    <div>Corrections: ${this.stats.correctionCount}</div>
                </div>
                <div>Uptime: ${uptimeStr}</div>
                <div style="margin-top: 5px; font-size: 10px; color: #888;">
                    Last Update: ${new Date(this.stats.lastUpdate).toLocaleTimeString()}
                </div>
            `;
        }

        logEvent(event, data = {}) {
            if (!this.enabled) return;
            
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] Network Event: ${event}`, data);
        }

        detectAnomaly(type, data) {
            if (!this.enabled) return;
            
            const timestamp = new Date().toISOString();
            console.warn(`[${timestamp}] Network Anomaly: ${type}`, data);
            
            // Visual indicator for anomalies
            if (this.overlay) {
                this.overlay.style.borderColor = '#ff0000';
                setTimeout(() => {
                    this.overlay.style.borderColor = '#00ff00';
                }, 1000);
            }
        }
    }

    // Global instance
    const networkStats = new NetworkStats();

    // Expose to global scope for easy access
    if (typeof window !== 'undefined') {
        window.networkStats = networkStats;
    }

    return { NetworkStats, networkStats };
}));
