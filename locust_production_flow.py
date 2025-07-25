#!/usr/bin/env python3

import time
import json
import base64
import random
from datetime import datetime
from locust import HttpUser, task, between
import lz4.frame

class ProductionFlowUser(HttpUser):
    """
    Simulates the production flow: Locust (LZ4) -> Slave Node -> Mobius
    This mimics the ESP32/Master sending LZ4-compressed data to the slave.
    """
    
    wait_time = between(1, 3)  # Realistic delays between requests
    
    def on_start(self):
        """Initialize user session"""
        self.user_id = random.randint(1000, 9999)
        self.container_counter = 0
        print(f"🚀 User {self.user_id} started - simulating ESP32/Master with LZ4 compression")
    
    def generate_realistic_container(self):
        """Generate realistic maritime container data"""
        self.container_counter += 1
        container_id = f"CONT{self.user_id:04d}{self.container_counter:03d}"
        
        return {
            "containerId": container_id,
            "iso6346": container_id,
            "timestamp": datetime.now().isoformat(),
            "location": {
                "latitude": round(random.uniform(25.0, 45.0), 6),
                "longitude": round(random.uniform(-125.0, -70.0), 6),
                "accuracy": random.randint(3, 15)
            },
            "sensors": {
                "temperature": round(random.uniform(-10.0, 50.0), 2),
                "humidity": round(random.uniform(30.0, 90.0), 2),
                "pressure": round(random.uniform(980.0, 1020.0), 2),
                "accelerometer": {
                    "x": round(random.uniform(-2.0, 2.0), 3),
                    "y": round(random.uniform(-2.0, 2.0), 3),
                    "z": round(random.uniform(8.0, 12.0), 3)
                }
            },
            "status": {
                "locked": random.choice([True, False]),
                "doorOpen": random.choice([True, False]),
                "batteryLevel": random.randint(15, 100),
                "signalStrength": random.randint(-90, -30)
            },
            "cargo": {
                "type": random.choice(["electronics", "textiles", "machinery", "food", "chemicals"]),
                "weight": random.randint(1000, 25000),
                "value": random.randint(10000, 500000),
                "hazardous": random.choice([True, False])
            },
            "transport": {
                "vesselName": f"MV-{random.randint(1000, 9999)}",
                "voyage": f"V{random.randint(100, 999)}",
                "port": random.choice(["USNYC", "USLAX", "USHOU", "USSEA", "USMIA"]),
                "eta": datetime.now().isoformat()
            }
        }
    
    def compress_batch(self, containers):
        """Compress batch using LZ4 (simulating ESP32/Master behavior)"""
        try:
            # Convert to JSON and then compress with LZ4
            json_data = json.dumps(containers, separators=(',', ':'))
            json_bytes = json_data.encode('utf-8')
            
            # LZ4 compression
            lz4_data = lz4.frame.compress(json_bytes, compression_level=lz4.frame.COMPRESSIONLEVEL_FAST)
            
            original_size = len(json_bytes)
            compressed_size = len(lz4_data)
            compression_ratio = original_size / compressed_size if compressed_size > 0 else 1.0
            
            payload = {
                "compressedData": base64.b64encode(lz4_data).decode('utf-8'),
                "metadata": {
                    "timestamp": datetime.now().isoformat(),
                    "sourceNode": "locust-master",
                    "compressionType": "lz4",
                    "originalSize": original_size,
                    "compressionRatio": round(compression_ratio, 2),
                    "containerCount": len(containers),
                    "batchId": f"BATCH_{int(time.time() * 1000)}"
                }
            }
            
            return payload, original_size, compressed_size, compression_ratio
            
        except Exception as e:
            print(f"❌ LZ4 compression failed: {e}")
            return None, 0, 0, 1.0
    
    @task(10)
    def send_single_container(self):
        """Send single container (most common scenario)"""
        container = self.generate_realistic_container()
        payload, original_size, compressed_size, compression_ratio = self.compress_batch([container])
        
        if payload:
            start_time = time.time()
            with self.client.post(
                "/api/receive-compressed",
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "ESP32-LZ4-Client/1.0"
                },
                catch_response=True
            ) as response:
                response_time = int((time.time() - start_time) * 1000)
                
                if response.status_code == 200:
                    print(f"✅ Single container: {container['containerId']} | "
                          f"Compression: {compression_ratio:.2f}:1 | "
                          f"Size: {original_size}→{compressed_size} bytes | "
                          f"Time: {response_time}ms")
                else:
                    print(f"❌ Failed: {container['containerId']} | Status: {response.status_code}")
                    response.failure(f"Status {response.status_code}")
    
    @task(3)
    def send_batch_containers(self):
        """Send batch of containers (less common but more efficient)"""
        batch_size = random.randint(2, 5)
        containers = [self.generate_realistic_container() for _ in range(batch_size)]
        payload, original_size, compressed_size, compression_ratio = self.compress_batch(containers)
        
        if payload:
            start_time = time.time()
            with self.client.post(
                "/api/receive-compressed",
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "ESP32-LZ4-Client/1.0"
                },
                catch_response=True
            ) as response:
                response_time = int((time.time() - start_time) * 1000)
                
                if response.status_code == 200:
                    container_ids = [c['containerId'] for c in containers]
                    print(f"✅ Batch ({batch_size}): {', '.join(container_ids)} | "
                          f"Compression: {compression_ratio:.2f}:1 | "
                          f"Size: {original_size}→{compressed_size} bytes | "
                          f"Time: {response_time}ms")
                else:
                    print(f"❌ Batch failed | Status: {response.status_code}")
                    response.failure(f"Status {response.status_code}")
    
    @task(1)
    def send_large_batch(self):
        """Send larger batch (simulating accumulated data)"""
        batch_size = random.randint(8, 15)
        containers = [self.generate_realistic_container() for _ in range(batch_size)]
        payload, original_size, compressed_size, compression_ratio = self.compress_batch(containers)
        
        if payload:
            start_time = time.time()
            with self.client.post(
                "/api/receive-compressed",
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "ESP32-LZ4-Client/1.0"
                },
                catch_response=True
            ) as response:
                response_time = int((time.time() * 1000) - start_time)
                
                if response.status_code == 200:
                    print(f"✅ Large batch ({batch_size}): {compression_ratio:.2f}:1 compression | "
                          f"Size: {original_size}→{compressed_size} bytes | "
                          f"Time: {response_time}ms")
                else:
                    print(f"❌ Large batch failed | Status: {response.status_code}")
                    response.failure(f"Status {response.status_code}")
    
    def on_stop(self):
        """Clean up when user stops"""
        print(f"🛑 User {self.user_id} stopped after {self.container_counter} containers")

if __name__ == "__main__":
    print("🧪 LZ4 Locust Production Flow Test")
    print("Pipeline: Locust (LZ4) → Slave Node (LZ4 decompress) → Mobius")
    print("Run with: locust -f locust_production_flow.py --host=http://slave-ip:3001") 