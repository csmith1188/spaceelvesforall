// Entity Synchronization Debug Tools
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SyncDebug = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    class SyncDebug {
        constructor() {
            this.enabled = false;
            this.entities = new Map(); // entityId -> { serverPos, clientPos, history, corrections }
            this.correctionThreshold = 5; // pixels
            this.historySize = 60; // frames
            this.ghostTrails = new Map(); // entityId -> trail points
        }

        start() {
            this.enabled = true;
            console.log('Sync Debug enabled - showing entity synchronization visualization');
        }

        stop() {
            this.enabled = false;
            this.entities.clear();
            this.ghostTrails.clear();
            console.log('Sync Debug disabled');
        }

        updateEntity(entityId, serverPos, clientPos) {
            if (!this.enabled) return;

            if (!this.entities.has(entityId)) {
                this.entities.set(entityId, {
                    serverPos: { ...serverPos },
                    clientPos: { ...clientPos },
                    history: [],
                    corrections: 0,
                    lastCorrection: 0
                });
            }

            const entity = this.entities.get(entityId);
            const oldClientPos = { ...entity.clientPos };
            
            entity.serverPos = { ...serverPos };
            entity.clientPos = { ...clientPos };

            // Check for large corrections
            const distance = Math.sqrt(
                Math.pow(clientPos.x - oldClientPos.x, 2) + 
                Math.pow(clientPos.y - oldClientPos.y, 2) + 
                Math.pow(clientPos.z - oldClientPos.z, 2)
            );

            if (distance > this.correctionThreshold) {
                entity.corrections++;
                entity.lastCorrection = Date.now();
                console.warn(`Large position correction for entity ${entityId}: ${distance.toFixed(2)} pixels`);
            }

            // Add to history
            entity.history.push({
                time: Date.now(),
                serverPos: { ...serverPos },
                clientPos: { ...clientPos },
                distance: distance
            });

            if (entity.history.length > this.historySize) {
                entity.history.shift();
            }

            // Update ghost trail
            this.updateGhostTrail(entityId, serverPos, clientPos);
        }

        updateGhostTrail(entityId, serverPos, clientPos) {
            if (!this.ghostTrails.has(entityId)) {
                this.ghostTrails.set(entityId, []);
            }

            const trail = this.ghostTrails.get(entityId);
            trail.push({
                time: Date.now(),
                serverPos: { ...serverPos },
                clientPos: { ...clientPos }
            });

            // Keep only recent trail points
            const cutoff = Date.now() - 2000; // 2 seconds
            while (trail.length > 0 && trail[0].time < cutoff) {
                trail.shift();
            }
        }

        draw(ctx, camera) {
            if (!this.enabled || !ctx) return;

            ctx.save();

            // Draw entity synchronization indicators
            for (const [entityId, entity] of this.entities) {
                this.drawEntitySync(ctx, camera, entityId, entity);
            }

            // Draw ghost trails
            for (const [entityId, trail] of this.ghostTrails) {
                this.drawGhostTrail(ctx, camera, entityId, trail);
            }

            ctx.restore();
        }

        drawEntitySync(ctx, camera, entityId, entity) {
            const screenPos = this.worldToScreen(entity.serverPos, camera);
            const clientScreenPos = this.worldToScreen(entity.clientPos, camera);

            // Calculate distance for color coding
            const distance = Math.sqrt(
                Math.pow(screenPos.x - clientScreenPos.x, 2) + 
                Math.pow(screenPos.y - clientScreenPos.y, 2)
            );

            // Color code based on error magnitude
            let errorColor = '#00ff00'; // green < 10px
            let errorAlpha = 0.3;
            if (distance > 30) {
                errorColor = '#ff0000'; // red > 30px
                errorAlpha = 0.6;
            } else if (distance > 10) {
                errorColor = '#ffff00'; // yellow 10-30px
                errorAlpha = 0.4;
            }

            // Draw server position with color-coded outline
            ctx.strokeStyle = errorColor;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, 20, 0, 2 * Math.PI);
            ctx.stroke();

            // Draw client position (blue outline)
            ctx.strokeStyle = '#0088ff';
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(clientScreenPos.x, clientScreenPos.y, 15, 0, 2 * Math.PI);
            ctx.stroke();

            // Draw correction line if there's a difference
            if (distance > 1) {
                ctx.strokeStyle = errorColor;
                ctx.lineWidth = Math.max(1, Math.min(distance / 10, 5));
                ctx.beginPath();
                ctx.moveTo(screenPos.x, screenPos.y);
                ctx.lineTo(clientScreenPos.x, clientScreenPos.y);
                ctx.stroke();

                // Flash effect for large corrections
                if (Date.now() - entity.lastCorrection < 500 && distance > 20) {
                    ctx.fillStyle = `rgba(255, 0, 0, ${errorAlpha})`;
                    ctx.fillRect(screenPos.x - 30, screenPos.y - 30, 60, 60);
                }
            }

            // Draw error distance and correction count
            ctx.font = '11px Arial';
            if (distance > 1) {
                ctx.fillStyle = errorColor;
                ctx.fillText(`${distance.toFixed(1)}px`, screenPos.x + 25, screenPos.y - 15);
            }
            if (entity.corrections > 0) {
                ctx.fillStyle = '#ff0000';
                ctx.fillText(`C: ${entity.corrections}`, screenPos.x + 25, screenPos.y);
            }
        }

        drawGhostTrail(ctx, camera, entityId, trail) {
            if (trail.length < 2) return;

            // Server position trail (green)
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < trail.length; i++) {
                const point = this.worldToScreen(trail[i].serverPos, camera);
                if (i === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            }
            ctx.stroke();

            // Client position trail (blue)
            ctx.strokeStyle = 'rgba(0, 136, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i < trail.length; i++) {
                const point = this.worldToScreen(trail[i].clientPos, camera);
                if (i === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            }
            ctx.stroke();
        }

        worldToScreen(worldPos, camera) {
            // Convert world position to screen position
            // This is a simplified version - you may need to adjust based on your camera system
            return {
                x: worldPos.x - camera.x + game.window.w / 2,
                y: worldPos.y - camera.y + game.window.h / 2
            };
        }

        getStats() {
            const stats = {
                totalEntities: this.entities.size,
                totalCorrections: 0,
                averageDistance: 0,
                maxDistance: 0
            };

            let totalDistance = 0;
            let count = 0;

            for (const [entityId, entity] of this.entities) {
                stats.totalCorrections += entity.corrections;
                
                const distance = Math.sqrt(
                    Math.pow(entity.serverPos.x - entity.clientPos.x, 2) + 
                    Math.pow(entity.serverPos.y - entity.clientPos.y, 2) + 
                    Math.pow(entity.serverPos.z - entity.clientPos.z, 2)
                );
                
                totalDistance += distance;
                count++;
                stats.maxDistance = Math.max(stats.maxDistance, distance);
            }

            if (count > 0) {
                stats.averageDistance = totalDistance / count;
            }

            return stats;
        }

        logSyncIssues() {
            console.log('=== Entity Synchronization Report ===');
            console.log(`Total entities: ${this.entities.size}`);
            
            for (const [entityId, entity] of this.entities) {
                if (entity.corrections > 0) {
                    console.log(`Entity ${entityId}: ${entity.corrections} corrections`);
                }
            }
            
            const stats = this.getStats();
            console.log(`Total corrections: ${stats.totalCorrections}`);
            console.log(`Average distance: ${stats.averageDistance.toFixed(2)}`);
            console.log(`Max distance: ${stats.maxDistance.toFixed(2)}`);
        }
    }

    // Global instance
    const syncDebug = new SyncDebug();

    // Expose to global scope for easy access
    if (typeof window !== 'undefined') {
        window.syncDebug = syncDebug;
    }

    return { SyncDebug, syncDebug };
}));
