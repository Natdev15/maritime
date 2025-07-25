"""
🎯 PRODUCTION FLOW LOCUST TESTING
Simulates real production flow: Local Machine → Slave → Mobius

HttpUser Class Implementation:
- Sends compressed data to Slave (like Master does)
- Slave decompresses and forwards to Mobius
- Measures end-to-end performance

🚀 USAGE:
locust -f locust_production_flow.py --host=http://172.25.1.78
"""

import json
import random
import time
import base64
from datetime import datetime
from locust import HttpUser, task, between, events
import msgpack

class ProductionFlowUser(HttpUser):
    """
    HttpUser simulating real production flow
    Local Machine → Slave (MessagePack) → Mobius (M2M)
    """
    wait_time = between(2, 5)  # 2-5 seconds between batches

    def on_start(self):
        print(f"🚀 Production User {id(self)} started - simulating master → slave → mobius flow")
        self.container_counter = random.randint(10000, 99999)
        self.slave_host = self.host
        self.slave_port = 3001
        self.slave_endpoint = f"{self.slave_host}:{self.slave_port}/api/receive-compressed"
        self.total_containers_sent = 0
        self.total_compression_ratio = 0.0
        self.compression_samples = 0
        print(f"📡 Target slave endpoint: {self.slave_endpoint}")

    def generate_realistic_container(self):
        self.container_counter += 1
        container_data = {
            "msisdn": f"39331553{random.randint(7800, 7999)}",
            "iso6346": f"PROD{self.container_counter:07d}",
            "time": datetime.now().strftime("%d%m%y %H%M%S.0"),
            "rssi": str(random.randint(10, 31)),
            "cgi": "999-01-1-31D41",
            "ble-m": "0",
            "bat-soc": str(random.randint(20, 100)),
            "acc": f"{random.uniform(-1000, 1000):.4f} {random.uniform(-5, 5):.4f} {random.uniform(-10, 10):.4f}",
            "temperature": f"{random.uniform(15, 35):.2f}",
            "humidity": f"{random.uniform(30, 70):.2f}",
            "pressure": f"{random.uniform(950, 1050):.4f}",
            "door": random.choice(["O", "D"]),
            "gnss": "1",
            "latitude": f"{random.uniform(30, 32):.4f}",
            "longitude": f"{random.uniform(27, 29):.4f}",
            "altitude": f"{random.uniform(0, 100):.2f}",
            "speed": f"{random.uniform(0, 50):.1f}",
            "heading": f"{random.uniform(0, 360):.2f}",
            "nsat": f"{random.randint(4, 12):02d}",
            "hdop": f"{random.uniform(0.5, 3.0):.1f}",
            "timestamp": datetime.now().isoformat()
        }
        return {"containerId": container_data["iso6346"], "data": container_data}

    def compress_batch(self, containers):
        try:
            # MessagePack encoding - highly efficient binary serialization
            msgpack_data = msgpack.packb(containers, use_bin_type=True)
            
            # Calculate compression metrics
            original_size = len(json.dumps(containers, separators=(',', ':')).encode('utf-8'))
            compressed_size = len(msgpack_data)
            compression_ratio = original_size / compressed_size if compressed_size > 0 else 1.0
            
            payload = {
                "compressedData": base64.b64encode(msgpack_data).decode('utf-8'),
                "metadata": {
                    "timestamp": datetime.now().isoformat(),
                    "sourceNode": "locust-master",
                    "compressionType": "messagepack",
                    "originalSize": original_size,
                    "compressionRatio": round(compression_ratio, 2),
                    "containerCount": len(containers),
                    "batchId": f"BATCH_{int(time.time() * 1000)}"
                }
            }
            return payload, original_size, compressed_size, compression_ratio
        except Exception as e:
            print(f"❌ MessagePack compression failed: {e}")
            return None, 0, 0, 1.0

    @task(10)
    def send_batch_to_slave(self):
        batch_start_time = time.time()
        batch_size = random.randint(3, 8)
        containers = [self.generate_realistic_container() for _ in range(batch_size)]
        payload, original_size, compressed_size, compression_ratio = self.compress_batch(containers)
        if not payload: return
        self.total_containers_sent += batch_size
        self.total_compression_ratio += compression_ratio
        self.compression_samples += 1
        with self.client.post(
            f":{self.slave_port}/api/receive-compressed",
            json=payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Locust-ProductionFlow/1.0",
                "X-Source": "locust-master",
                "X-Batch-Size": str(batch_size)
            },
            catch_response=True,
            name="production_flow"
        ) as response:
            total_time = int((time.time() - batch_start_time) * 1000)
            if response.status_code == 200:
                avg_compression = self.total_compression_ratio / self.compression_samples
                print(f"✅ PRODUCTION: {batch_size} containers → slave → mobius in {total_time}ms")
                print(f"   📊 Compression: {original_size}B → {compressed_size}B ({compression_ratio:.1f}:1)")
                print(f"   📈 Session avg compression: {avg_compression:.1f}:1 | Total containers: {self.total_containers_sent}")
                response.success()
                events.request.fire(
                    request_type="COMPRESSION", name="compression_ratio",
                    response_time=compression_ratio * 100, response_length=compressed_size,
                    exception=None, context={}
                )
            elif response.status_code == 500:
                print(f"⚠️ PRODUCTION: Slave processing failed (HTTP 500) after {total_time}ms")
                print(f"   📦 Batch: {batch_size} containers, {original_size}B original data")
                response.failure("Slave processing/forwarding failed")
            else:
                print(f"❌ PRODUCTION: Unexpected response {response.status_code} after {total_time}ms")
                response.failure(f"Unexpected status: {response.status_code}")

    @task(2)
    def health_check_slave(self):
        with self.client.get(
            f":{self.slave_port}/api/health", catch_response=True, name="health_check"
        ) as response:
            if response.status_code == 200:
                print(f"💓 Health check: Slave is healthy")
                response.success()
            else:
                print(f"⚠️ Health check: Slave returned {response.status_code}")
                response.failure("Health check failed")

    def on_stop(self):
        if self.compression_samples > 0:
            avg_compression = self.total_compression_ratio / self.compression_samples
            print(f"📊 USER {id(self)} FINAL STATS:")
            print(f"   Total containers sent: {self.total_containers_sent}")
            print(f"   Average compression ratio: {avg_compression:.1f}:1")
            print(f"   Compression samples: {self.compression_samples}")

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("🚀 PRODUCTION FLOW TEST STARTED")
    print(f"📡 Target: {environment.host}:3001/api/receive-compressed")
    print(f"🔄 Flow: Locust → Slave → Mobius")

@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    print("🏁 PRODUCTION FLOW TEST COMPLETED")
    print("📊 Check metrics for 'production_flow' and 'compression_ratio'")

# 🎯 USAGE INSTRUCTIONS:
"""
🚀 HOW TO RUN PRODUCTION FLOW TEST:

1. Start Locust:
   locust -f locust_production_flow.py --host=http://172.25.1.78

2. Open Web UI:
   http://localhost:8089

3. Configure Test:
   - Users: 5-20 (simulates multiple master nodes)
   - Spawn rate: 1-2 users/sec
   - Duration: 10-30 minutes

📊 METRICS TO MONITOR:

PRIMARY METRICS:
- production_flow: End-to-end performance (Local → Slave → Mobius)
- health_check: Slave availability

CUSTOM METRICS:
- compression_ratio: Shows compression efficiency over time

CONSOLE OUTPUT:
- Real-time compression ratios
- Total containers processed
- Processing times per batch

🎯 WHAT THIS TESTS:

✅ Real production data flow
✅ Batch compression efficiency  
✅ Slave decompression performance
✅ Slave → Mobius forwarding
✅ End-to-end response times
✅ Error handling and recovery
✅ System capacity under load

📈 EXPECTED RESULTS:

- Response times: 50-150ms for small batches
- Compression ratios: 2.5-4:1 depending on batch size
- Success rates: >95% under normal load
- Throughput: 20-100 containers/minute per user

🔧 OPTIMIZATION INSIGHTS:

- Monitor compression ratios vs batch sizes
- Identify optimal batch sizes for your data
- Find maximum sustainable load
- Validate 10k container capacity
""" 