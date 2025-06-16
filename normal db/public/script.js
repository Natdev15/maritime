class MaritimeDashboard {
    constructor() {
        this.autoRefresh = false;
        this.refreshInterval = null;
        this.chart = null;
        this.containers = [];
        this.filteredContainers = [];
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadInitialData();
        this.setupChart();
        
        // Hide loading overlay
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    setupEventListeners() {
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadData();
        });

        // Auto refresh toggle
        document.getElementById('autoRefreshBtn').addEventListener('click', () => {
            this.toggleAutoRefresh();
        });

        // Search functionality
        document.getElementById('searchContainer').addEventListener('input', (e) => {
            this.filterContainers(e.target.value);
        });

        // Modal close
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        // Close modal on background click
        document.getElementById('containerModal').addEventListener('click', (e) => {
            if (e.target.id === 'containerModal') {
                this.closeModal();
            }
        });

        // Event delegation for view details buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('view-details-btn')) {
                const containerId = e.target.getAttribute('data-container-id');
                this.showContainerDetails(containerId);
            }
        });
    }

    async loadInitialData() {
        await this.loadData();
        await this.loadStats();
    }

    async loadData() {
        try {
            this.showLoading();
            
            const response = await fetch('/api/containers?limit=100');
            const data = await response.json();
            
            this.containers = data.containers || [];
            this.filteredContainers = [...this.containers];
            
            this.updateContainerTable();
            this.updateChart();
            
        } catch (error) {
            console.error('Error loading container data:', error);
            this.showError('Failed to load container data');
        } finally {
            this.hideLoading();
        }
    }

    async loadStats() {
        try {
            const response = await fetch('/api/stats');
            const stats = await response.json();
            
            this.updateSystemStats(stats);
            this.updateHeaderStats(stats);
            
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    updateSystemStats(stats) {
        document.getElementById('totalRecords').textContent = stats.database?.totalRecords || 0;
        document.getElementById('uniqueContainers').textContent = stats.database?.uniqueContainers || 0;
        
        const successRate = stats.server?.successRate || 0;
        document.getElementById('successRate').textContent = `${successRate}%`;
        
        // Show average row size instead of compression ratio
        const avgRowSize = stats.database?.avgRowSize || 0;
        document.getElementById('avgCompression').textContent = this.formatBytes(avgRowSize);
    }

    updateHeaderStats(stats) {
        document.getElementById('totalContainers').textContent = stats.database?.uniqueContainers || 0;
        document.getElementById('queueLength').textContent = stats.queue?.length || 0;
        document.getElementById('uptime').textContent = this.formatUptime(stats.server?.uptime || 0);
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    updateContainerTable() {
        const tbody = document.getElementById('containerTableBody');
        tbody.innerHTML = '';

        this.filteredContainers.forEach(container => {
            const row = this.createContainerRow(container);
            tbody.appendChild(row);
        });
    }

    createContainerRow(container) {
        const row = document.createElement('tr');
        
        // Determine status based on various factors
        const status = this.getContainerStatus(container);
        
        row.innerHTML = `
            <td>
                <strong>${container.containerId}</strong>
                <br><small>${container.iso6346 || 'N/A'}</small>
            </td>
            <td>${this.formatLocation(container)}</td>
            <td>${container.temperature ? container.temperature.toFixed(1) + '°C' : '-'}</td>
            <td>${container.batSoc || '-'}%</td>
            <td><span class="status-badge status-${status.class}">${status.text}</span></td>
            <td>
                ${this.formatDateTime(container.timestamp)}
                <br><small>Size: ${this.formatBytes(container.rowSize || 0)} | 
                Time: ${container.processingTime || 0}ms</small>
            </td>
            <td>
                <button class="btn-small view-details-btn" data-container-id="${container.containerId}">
                    View Details
                </button>
            </td>
        `;

        return row;
    }

    getContainerStatus(container) {
        const battery = parseInt(container.batSoc || 100);
        const temp = parseFloat(container.temperature || 20);
        
        if (battery < 20 || temp > 30 || temp < -10) {
            return { class: 'critical', text: 'Critical' };
        } else if (battery < 50 || temp > 25 || temp < 0) {
            return { class: 'warning', text: 'Warning' };
        } else {
            return { class: 'normal', text: 'Normal' };
        }
    }

    formatLocation(container) {
        if (container.latitude && container.longitude) {
            return `${parseFloat(container.latitude).toFixed(4)}, ${parseFloat(container.longitude).toFixed(4)}`;
        }
        return 'Unknown';
    }

    formatDateTime(timestamp) {
        if (!timestamp) return '-';
        const date = new Date(timestamp);
        return date.toLocaleString();
    }

    filterContainers(searchTerm) {
        if (!searchTerm) {
            this.filteredContainers = [...this.containers];
        } else {
            this.filteredContainers = this.containers.filter(container => 
                container.containerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (container.iso6346 && container.iso6346.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }
        this.updateContainerTable();
    }

    async showContainerDetails(containerId) {
        try {
            const response = await fetch(`/api/containers/${containerId}?limit=20`);
            const data = await response.json();
            
            this.displayContainerModal(data, containerId);
        } catch (error) {
            console.error('Error loading container details:', error);
            this.showError('Failed to load container details');
        }
    }

    displayContainerModal(containerData, containerId) {
        const modal = document.getElementById('containerModal');
        const modalTitle = document.getElementById('modalTitle');
        const containerDetails = document.getElementById('containerDetails');
        
        modalTitle.textContent = `Container Details: ${containerId}`;
        
        const history = containerData.history || [];
        const latest = history[0] || {};
        
        containerDetails.innerHTML = `
            <div class="container-details">
                <div class="details-grid">
                    <div class="detail-card">
                        <h4>📦 Container Information</h4>
                        <div class="detail-row">
                            <span class="detail-label">Container ID:</span>
                            <span class="detail-value">${latest.containerId || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">ISO 6346:</span>
                            <span class="detail-value">${latest.iso6346 || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">MSISDN:</span>
                            <span class="detail-value">${latest.msisdn || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Data Size:</span>
                            <span class="detail-value">${this.formatBytes(latest.rowSize || 0)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Processing Time:</span>
                            <span class="detail-value">${latest.processingTime || 0}ms</span>
                        </div>
                    </div>
                    
                    <div class="detail-card">
                        <h4>📍 Location & Movement</h4>
                        <div class="detail-row">
                            <span class="detail-label">Latitude:</span>
                            <span class="detail-value">${latest.latitude ? latest.latitude.toFixed(6) : 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Longitude:</span>
                            <span class="detail-value">${latest.longitude ? latest.longitude.toFixed(6) : 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Altitude:</span>
                            <span class="detail-value">${latest.altitude ? latest.altitude.toFixed(1) + 'm' : 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Speed:</span>
                            <span class="detail-value">${latest.speed ? latest.speed.toFixed(1) + ' km/h' : 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Heading:</span>
                            <span class="detail-value">${latest.heading ? latest.heading.toFixed(1) + '°' : 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div class="detail-card">
                        <h4>🌡️ Environmental Conditions</h4>
                        <div class="detail-row">
                            <span class="detail-label">Temperature:</span>
                            <span class="detail-value">${latest.temperature ? latest.temperature.toFixed(1) + '°C' : 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Humidity:</span>
                            <span class="detail-value">${latest.humidity ? latest.humidity.toFixed(1) + '%' : 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Pressure:</span>
                            <span class="detail-value">${latest.pressure ? latest.pressure.toFixed(1) + ' hPa' : 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Door Status:</span>
                            <span class="detail-value">${latest.door === 'D' ? 'Closed' : latest.door === 'O' ? 'Open' : 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div class="detail-card">
                        <h4>🔋 System Status</h4>
                        <div class="detail-row">
                            <span class="detail-label">Battery SoC:</span>
                            <span class="detail-value">${latest.batSoc || 'N/A'}%</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">RSSI:</span>
                            <span class="detail-value">${latest.rssi || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">CGI:</span>
                            <span class="detail-value">${latest.cgi || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">GNSS:</span>
                            <span class="detail-value">${latest.gnss === '1' ? 'Active' : 'Inactive'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Satellites:</span>
                            <span class="detail-value">${latest.nsat || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">HDOP:</span>
                            <span class="detail-value">${latest.hdop ? latest.hdop.toFixed(1) : 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="history-section">
                    <h4>📊 Recent History (${history.length} records)</h4>
                    <div class="performance-summary">
                        <div class="perf-stat">
                            <span class="perf-label">Total Data Size:</span>
                            <span class="perf-value">${this.formatBytes(containerData.totalDataSize || 0)}</span>
                        </div>
                        <div class="perf-stat">
                            <span class="perf-label">Avg Row Size:</span>
                            <span class="perf-value">${this.formatBytes(containerData.avgRowSize || 0)}</span>
                        </div>
                        <div class="perf-stat">
                            <span class="perf-label">Processing Time Range:</span>
                            <span class="perf-value">${this.getProcessingTimeRange(history)}</span>
                        </div>
                    </div>
                    
                    <div class="history-table-container">
                        <table class="history-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Location</th>
                                    <th>Temp</th>
                                    <th>Battery</th>
                                    <th>Size</th>
                                    <th>Proc Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${history.slice(0, 10).map(record => `
                                    <tr>
                                        <td>${this.formatDateTime(record.timestamp)}</td>
                                        <td>${this.formatLocation(record)}</td>
                                        <td>${record.temperature ? record.temperature.toFixed(1) + '°C' : '-'}</td>
                                        <td>${record.batSoc || '-'}%</td>
                                        <td>${this.formatBytes(record.rowSize || 0)}</td>
                                        <td>${record.processingTime || 0}ms</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
    }

    getProcessingTimeRange(history) {
        if (!history || history.length === 0) return 'N/A';
        
        const times = history.map(h => h.processingTime || 0).filter(t => t > 0);
        if (times.length === 0) return 'N/A';
        
        const min = Math.min(...times);
        const max = Math.max(...times);
        
        if (min === max) return `${min}ms`;
        return `${min}-${max}ms`;
    }

    closeModal() {
        document.getElementById('containerModal').style.display = 'none';
    }

    setupChart() {
        const ctx = document.getElementById('activityChart').getContext('2d');
        this.chart = this.initializeChart(ctx);
    }

    initializeChart(ctx) {
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Container Updates',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }, {
                    label: 'Avg Row Size (KB)',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Updates Count'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Avg Size (KB)'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                }
            }
        });
    }

    async updateChart() {
        try {
            const response = await fetch('/api/stats');
            const stats = await response.json();
            
            const recentActivity = stats.database?.recentActivity || [];
            
            if (recentActivity.length > 0) {
                const labels = recentActivity.map(activity => activity.date);
                const counts = recentActivity.map(activity => activity.count);
                const avgSizes = recentActivity.map(activity => (activity.avg_size || 0) / 1024); // Convert to KB
                
                this.chart.data.labels = labels;
                this.chart.data.datasets[0].data = counts;
                this.chart.data.datasets[1].data = avgSizes;
                this.chart.update();
            }
        } catch (error) {
            console.error('Error updating chart:', error);
        }
    }

    toggleAutoRefresh() {
        this.autoRefresh = !this.autoRefresh;
        const btn = document.getElementById('autoRefreshBtn');
        
        if (this.autoRefresh) {
            btn.textContent = '⏰ Auto Refresh: ON';
            btn.classList.add('active');
            this.refreshInterval = setInterval(() => {
                this.loadData();
                this.loadStats();
            }, 30000); // Refresh every 30 seconds
        } else {
            btn.textContent = '⏰ Auto Refresh: OFF';
            btn.classList.remove('active');
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
                this.refreshInterval = null;
            }
        }
    }

    showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    showError(message) {
        console.error(message);
        // You could implement a toast notification here
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MaritimeDashboard();
});

// Add some CSS for history items
const additionalStyles = `
    .history-list {
        max-height: 200px;
        overflow-y: auto;
    }
    
    .history-item {
        padding: 8px;
        margin-bottom: 8px;
        background: #f8f9fa;
        border-radius: 4px;
        font-size: 0.9rem;
    }
    
    .history-item:last-child {
        margin-bottom: 0;
    }
`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet); 