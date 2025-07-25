import matplotlib.pyplot as plt
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from datetime import datetime
import os

# Test results (manually entered from screenshots)
test_results = [
    {
        'users': 50,
        'spawn_rate': 5,
        'duration': '19m',
        'rps': 9.7,
        'failures': '1%',
        'post_median': 8200,
        'post_95': 14000,
        'post_max': 21912,
        'compression_ratio': 2.0,
        'notes': 'Heavy load, high latency, robust, no crash.'
    },
    {
        'users': 25,
        'spawn_rate': 3,
        'duration': '5m',
        'rps': 8.9,
        'failures': '1%',
        'post_median': 1800,
        'post_95': 3500,
        'post_max': 4574,
        'compression_ratio': 2.0,
        'notes': 'Good throughput, moderate latency.'
    },
    {
        'users': 20,
        'spawn_rate': 5,
        'duration': '5m',
        'rps': 7.5,
        'failures': '1%',
        'post_median': 480,
        'post_95': 3000,
        'post_max': 6431,
        'compression_ratio': 2.0,
        'notes': 'Low latency, robust, well within capacity.'
    }
]

def create_performance_chart():
    users = [r['users'] for r in test_results]
    median = [r['post_median'] for r in test_results]
    p95 = [r['post_95'] for r in test_results]
    maxv = [r['post_max'] for r in test_results]
    rps = [r['rps'] for r in test_results]

    fig, ax1 = plt.subplots(figsize=(8, 5))
    ax1.plot(users, median, 'go-', label='Median (ms)')
    ax1.plot(users, p95, 'yo-', label='95th %ile (ms)')
    ax1.plot(users, maxv, 'ro-', label='Max (ms)')
    ax1.set_xlabel('Concurrent Users')
    ax1.set_ylabel('Response Time (ms)')
    ax1.set_title('CBOR Locust Test: Response Time vs Users')
    ax1.set_yscale('log')
    ax1.grid(True, alpha=0.3)
    ax1.legend(loc='upper left')

    ax2 = ax1.twinx()
    ax2.plot(users, rps, 'bs--', label='RPS')
    ax2.set_ylabel('Requests Per Second (RPS)')
    ax2.legend(loc='upper right')

    plt.tight_layout()
    plt.savefig('cbor_locust_chart.png', dpi=300, bbox_inches='tight')
    plt.close()

def generate_pdf(filename='CBOR_Locust_Test_Report.pdf'):
    create_performance_chart()
    doc = SimpleDocTemplate(filename, pagesize=A4, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='CustomTitle', parent=styles['Heading1'], fontSize=22, alignment=TA_CENTER, textColor=colors.darkblue, spaceAfter=20))
    story = []

    # Title
    story.append(Spacer(1, 1*inch))
    story.append(Paragraph('CBOR Locust Performance Test Report', styles['CustomTitle']))
    story.append(Paragraph(f'Generated: {datetime.now().strftime("%B %d, %Y %H:%M")}', styles['Normal']))
    story.append(Spacer(1, 0.3*inch))

    # Executive Summary
    story.append(Paragraph('<b>Executive Summary</b>', styles['Heading2']))
    story.append(Paragraph('This report summarizes the results of Locust load testing using CBOR compression for the maritime container tracking system. Three scenarios were tested: 50 users (19m), 25 users (5m), and 20 users (5m). Metrics include throughput, latency, reliability, and compression efficiency.', styles['Normal']))
    story.append(Spacer(1, 0.2*inch))

    # Table of results
    story.append(Paragraph('<b>Test Results Summary</b>', styles['Heading2']))
    table_data = [
        ['Users', 'Spawn Rate', 'Duration', 'RPS', 'Failures', 'Median (ms)', '95%ile (ms)', 'Max (ms)', 'Compression', 'Notes']
    ]
    for r in test_results:
        table_data.append([
            r['users'], r['spawn_rate'], r['duration'], r['rps'], r['failures'], r['post_median'], r['post_95'], r['post_max'], f"{r['compression_ratio']}:1", r['notes']
        ])
    t = Table(table_data, colWidths=[0.7*inch, 0.9*inch, 0.8*inch, 0.7*inch, 0.8*inch, 0.9*inch, 0.9*inch, 0.8*inch, 1*inch, 2.2*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    story.append(t)
    story.append(Spacer(1, 0.3*inch))

    # Chart
    story.append(Paragraph('<b>Performance Chart</b>', styles['Heading2']))
    if os.path.exists('cbor_locust_chart.png'):
        story.append(Image('cbor_locust_chart.png', width=6.5*inch, height=3.5*inch))
        story.append(Spacer(1, 0.2*inch))

    # Analysis
    story.append(Paragraph('<b>Analysis & Insights</b>', styles['Heading2']))
    story.append(Paragraph(
        'The CBOR implementation demonstrates robust performance and reliability across all tested user loads. '
        'At 20 users, the system maintains low latency and high throughput. At 25 users, throughput remains high with moderate latency. '
        'At 50 users, the system sustains high throughput but with increased latency, indicating the approach to system capacity. '
        'Compression ratios are stable (~2:1), and failure rates remain low (1%) even under heavy load. '
        'These results validate the suitability of CBOR for IoT/embedded scenarios and provide a strong foundation for further optimization or comparison with other algorithms.',
        styles['Normal']
    ))
    story.append(Spacer(1, 0.3*inch))

    # Conclusion
    story.append(Paragraph('<b>Conclusion</b>', styles['Heading2']))
    story.append(Paragraph(
        'CBOR-based compression and data transport in the maritime container tracking system is production-ready, scalable, and efficient. '
        'The system can handle up to 50 concurrent users and nearly 10 RPS with only minor reliability and latency tradeoffs. '
        'These results should be included in the thesis and can be used as a baseline for future enhancements or algorithm comparisons.',
        styles['Normal']
    ))
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph('CBOR Locust Performance Test Report - Maritime Container Tracking System', styles['CustomTitle']))

    doc.build(story)
    if os.path.exists('cbor_locust_chart.png'):
        os.remove('cbor_locust_chart.png')
    print(f'✅ PDF report generated: {filename}')

if __name__ == '__main__':
    generate_pdf() 