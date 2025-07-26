#!/usr/bin/env python3
"""
Simplified Astrocast Maritime IoT Pipeline Stress Testing with Locust
Tests one endpoint at a time based on the host configuration
"""

import time
import json
import random
import cbor2
from datetime import datetime, timedelta
from locust import HttpUser, task, between, events


class AstrocastUser(HttpUser):
    """
    HTTP User class for Astrocast Maritime IoT Pipeline testing
    Automatically detects which endpoint to test based on host
    """
    
    wait_time = between(2, 5)
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.container_id = random.randint(1000, 9999)
        self.device_id = f"ESP32_MARITIME_{self.container_id:04d}"
        self.record_index = 0
        
        # Determine which endpoint we're testing based on host
        self.is_slave_test = "3001" in self.host
        self.is_mobius_test = "7579" in self.host
        
    def on_start(self):
        """Called when a user starts"""
        if self.is_slave_test:
            print(f"🚢 Slave User {self.device_id} started - Host: {self.host}")
        elif self.is_mobius_test:
            print(f"📡 Mobius User {self.device_id} started - Host: {self.host}")
        else:
            print(f"❓ Unknown User {self.device_id} started - Host: {self.host}")
    
    def on_stop(self):
        """Called when a user stops"""
        print(f"📊 User {self.device_id} completed")
    
    def generate_compressed_payload_cbor(self):
        """Generate CBOR-compressed payload for Slave endpoint"""
        compressed_data = {
            "m": f"39331553789{self.container_id % 10}",
            "t": f"{datetime.now().strftime('%y%m%d%H%M')}",
            "l": round(31.89 + (self.container_id * 0.01), 2),
            "o": round(28.70 + (self.container_id * 0.01), 2),
            "e": round(15 + (self.container_id % 10)),
            "h": round(40 + (self.container_id % 20)),
            "s": 80 + (self.container_id % 20),
            "d": "D" if self.container_id % 2 == 0 else "O"
        }
        
        # Encode as CBOR binary
        return cbor2.dumps(compressed_data)
    
    def generate_sensor_data(self):
        """Generate realistic maritime sensor data"""
        base_time = datetime.now() + timedelta(minutes=self.record_index)
        time_str = base_time.strftime('%y%m%d %H%M%S') + '.0'
        
        return {
            "msisdn": f"39331553789{self.container_id % 10}",
            "iso6346": f"LMCU123123{self.container_id}",
            "time": time_str,
            "rssi": f"{20 + (self.container_id % 20)}",
            "cgi": f"999-01-1-31D4{self.container_id}",
            "ble-m": f"{self.container_id % 2}",
            "bat-soc": f"{80 + (self.container_id % 20)}",
            "acc": f"{-1000 + (self.container_id * 10)}.0407 -1.4649 -4.3947",
            "temperature": f"{15 + (self.container_id % 10)}.00",
            "humidity": f"{40 + (self.container_id % 20)}.00",
            "pressure": f"{1010 + (self.container_id % 10)}.5043",
            "door": "D" if self.container_id % 2 == 0 else "O",
            "gnss": "1",
            "latitude": f"{31.89 + (self.container_id * 0.01):.4f}",
            "longitude": f"{28.70 + (self.container_id * 0.01):.4f}",
            "altitude": f"{35 + (self.container_id % 10)}.10",
            "speed": f"{25 + (self.container_id % 10)}.3",
            "heading": f"{120 + (self.container_id % 20)}.31",
            "nsat": f"0{6 + (self.container_id % 4)}",
            "hdop": f"{1.5 + (self.container_id * 0.1):.1f}"
        }
    
    def generate_mobius_payload(self):
        """Generate complete Mobius payload"""
        sensor_data = self.generate_sensor_data()
        return {
            "m2m:cin": {
                "con": sensor_data
            }
        }
    
    @task
    def test_endpoint(self):
        """Test the appropriate endpoint based on host"""
        if self.is_slave_test:
            self.test_slave_endpoint()
        elif self.is_mobius_test:
            self.test_mobius_endpoint()
        else:
            print(f"❌ Unknown endpoint for host: {self.host}")
    
    def test_slave_endpoint(self):
        """Test Slave Node endpoint with CBOR binary data"""
        try:
            # Generate CBOR-compressed payload
            cbor_data = self.generate_compressed_payload_cbor()
            
            # Headers for Slave endpoint
            headers = {
                'Content-Type': 'application/octet-stream',
                'Device-ID': self.device_id,
                'Network-Type': 'astrocast',
                'Compression-Type': 'astrocast-cbor',
                'Original-Size': '378',
                'Astrocast-Compatible': 'true'
            }
            
            # Send CBOR binary data to Slave endpoint
            with self.client.post(
                "/api/receive-compressed",
                data=cbor_data,
                headers=headers,
                catch_response=True,
                name="Slave Node - CBOR Data"
            ) as response:
                
                if response.status_code == 200:
                    print(f"✅ Slave {self.device_id}: Success ({len(cbor_data)} bytes)")
                    response.success()
                elif response.status_code == 409:
                    print(f"⚠️  Slave {self.device_id}: 409 Conflict (OK)")
                    response.success()
                else:
                    print(f"❌ Slave {self.device_id}: HTTP {response.status_code}")
                    response.failure(f"HTTP {response.status_code}")
                    
        except Exception as e:
            print(f"❌ Slave {self.device_id}: Exception - {str(e)}")
            raise
    
    def test_mobius_endpoint(self):
        """Test Mobius Platform endpoint"""
        try:
            # Generate Mobius payload
            mobius_payload = self.generate_mobius_payload()
            
            # Generate request ID
            timestamp = int(time.time() * 1000)
            request_id = f"req-{timestamp}"
            
            # Headers
            headers = {
                'Content-Type': 'application/json;ty=4',
                'X-M2M-RI': request_id,
                'X-M2M-Origin': self.device_id,
                'Accept': 'application/json'
            }
            
            # Send request
            with self.client.post(
                "/Mobius/Natesh/NateshContainer?ty=4",
                json=mobius_payload,
                headers=headers,
                catch_response=True,
                name="Mobius Platform - JSON Data"
            ) as response:
                
                if response.status_code in [200, 201]:
                    print(f"✅ Mobius {self.device_id}: Success")
                    response.success()
                elif response.status_code == 409:
                    print(f"⚠️  Mobius {self.device_id}: 409 Conflict (OK)")
                    response.success()
                else:
                    print(f"❌ Mobius {self.device_id}: HTTP {response.status_code}")
                    response.failure(f"HTTP {response.status_code}")
                    
        except Exception as e:
            print(f"❌ Mobius {self.device_id}: Exception - {str(e)}")
            raise
    
    def increment_record_index(self):
        """Increment record index"""
        self.record_index += 1


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Test start event"""
    print(f"\n🚀 Astrocast Stress Test Starting")
    print(f"📡 Host: {environment.host}")
    
    # Determine which endpoint we're testing
    if "3001" in environment.host:
        print(f"🎯 Testing: Slave Node (CBOR binary data)")
        print(f"   Endpoint: /api/receive-compressed")
    elif "7579" in environment.host:
        print(f"🎯 Testing: Mobius Platform (JSON data)")
        print(f"   Endpoint: /Mobius/Natesh/NateshContainer?ty=4")
    else:
        print(f"🎯 Testing: Unknown endpoint")
    
    print(f"✅ Ready to begin!\n")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Test stop event"""
    print(f"\n🏁 Astrocast Stress Test Completed")
    print(f"📈 Final Statistics:")
    print(f"   Total Requests: {environment.stats.total.num_requests}")
    print(f"   Failed Requests: {environment.stats.total.num_failures}")
    print(f"   Average Response Time: {environment.stats.total.avg_response_time:.2f}ms")
    print(f"   Requests/sec: {environment.stats.total.current_rps:.2f}")
    print(f"🎯 Test completed!\n")


if __name__ == "__main__":
    print("🚢 Astrocast Maritime IoT Pipeline Locust Test")
    print("📋 Usage:")
    print("   # Test Slave Node (CBOR binary)")
    print("   locust -f locust_astrocast_simple.py --host=http://172.25.1.78:3001 --users=10 --spawn-rate=2 --run-time=5m")
    print("   ")
    print("   # Test Mobius Platform (JSON)")
    print("   locust -f locust_astrocast_simple.py --host=http://172.25.1.78:7579 --users=10 --spawn-rate=2 --run-time=5m")
    print("   ")
    print("🎯 Note: Test one endpoint at a time for accurate results!") 