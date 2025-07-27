#!/usr/bin/env python3
"""
Locust Stress Testing for Maritime IoT Pipeline
Tests ESP32 CBOR Encoder -> Decoder (VM) -> Mobius (VM) pipeline

Usage:
    locust -f locustfile.py --host=http://172.25.1.78:3001
    locust -f locustfile.py --host=http://172.25.1.78:3001 --users=10 --spawn-rate=2
    locust -f locustfile.py --host=http://172.25.1.78:3001 --users=20 --spawn-rate=5
    locust -f locustfile.py --host=http://172.25.1.78:3001 --users=30 --spawn-rate=10
"""

import time
import random
import json
import base64
from datetime import datetime, timedelta
from locust import HttpUser, task, between, events
import cbor2

class MaritimeIoTUser(HttpUser):
    """
    Locust user class for testing maritime IoT pipeline
    Simulates ESP32 devices sending CBOR-encoded payloads to decoder
    """
    
    wait_time = between(2, 5)  # Realistic wait between requests (2-5 seconds per user)
    
    def on_start(self):
        """Initialize user with test data"""
        self.decoder_url = "http://172.25.1.78:3001"
        self.mobius_url = "http://172.25.1.78:7579/Mobius/Natesh/NateshContainer?ty=4"
        
        # Field mapping for CBOR encoding (matches esp32-encoder.js)
        self.field_mapping = {
            'msisdn': 0, 'iso6346': 1, 'time': 2, 'rssi': 3, 'cgi': 4,
            'bat-soc': 5, 'acc': 6, 'temperature': 7, 'humidity': 8,
            'pressure': 9, 'door': 10, 'latitude': 11, 'longitude': 12,
            'altitude': 13, 'speed': 14, 'heading': 15, 'ble-m': 16,
            'gnss': 17, 'nsat': 18, 'hdop': 19
        }
        
        # Optimized quantization factors for target size (165-170 bytes)
        self.quantization_factors = {
            'temperature': 10, 'humidity': 10, 'pressure': 100,  # Reduced factors
            'latitude': 100, 'longitude': 100, 'altitude': 1,   # Reduced factors
            'speed': 1, 'heading': 1, 'acc': 10, 'hdop': 1     # Reduced factors
        }
        
        print(f"🚀 Maritime IoT User initialized - Target: {self.decoder_url}")
    
    def generate_esp32_payload(self):
        """Generate realistic ESP32 sensor data with optimized values"""
        # Base timestamp
        base_time = datetime.now()
        
        # Generate realistic maritime container data with optimized ranges
        payload = {
            'msisdn': f"393315537{random.randint(100, 999)}",
            'iso6346': f"LMCU{random.randint(100000, 999999)}",
            'time': base_time.strftime("%y%m%d %H%M%S.0"),
            'rssi': str(random.randint(-80, -40)),  # More realistic RSSI range
            'cgi': f"{random.randint(100, 999)}-{random.randint(1, 99)}-{random.randint(1, 99)}-{random.randint(1000, 9999)}",
            'bat-soc': str(random.randint(20, 95)),  # More realistic battery range
            'acc': f"{random.uniform(-500, 500):.1f} {random.uniform(-5, 5):.1f} {random.uniform(-5, 5):.1f}",  # Reduced precision
            'temperature': f"{random.uniform(10, 40):.1f}",  # Reduced precision
            'humidity': f"{random.uniform(20, 80):.1f}",  # Reduced precision
            'pressure': f"{random.uniform(950, 1050):.1f}",  # Reduced precision
            'door': random.choice(['O', 'C', 'D']),
            'latitude': f"{random.uniform(25, 35):.3f}",  # Reduced precision
            'longitude': f"{random.uniform(25, 35):.3f}",  # Reduced precision
            'altitude': f"{random.uniform(0, 100):.1f}",  # Reduced precision
            'speed': f"{random.uniform(0, 30):.1f}",  # Reduced range
            'heading': f"{random.uniform(0, 360):.1f}",  # Reduced precision
            'ble-m': str(random.randint(0, 1)),
            'gnss': str(random.randint(0, 1)),
            'nsat': f"{random.randint(6, 10):02d}",  # More realistic satellite count
            'hdop': f"{random.uniform(1.0, 3.0):.1f}"  # More realistic HDOP
        }
        
        return payload
    
    def encode_cbor(self, sensor_data):
        """Encode sensor data to CBOR format (matches esp32-encoder.js logic)"""
        try:
            # Create optimized data structure
            optimized_data = {}
            
            # Add version and codec info (matches esp32-encoder.js exactly)
            optimized_data[0xFF] = 1  # Version (255)
            optimized_data[0xFE] = 1  # Codec (254)
            
            # Process each field with optimization
            for field_name, field_id in self.field_mapping.items():
                if field_name in sensor_data:
                    value = sensor_data[field_name]
                    
                    # Apply field-specific optimizations
                    if field_name == 'msisdn':
                        # Keep only last 2 digits
                        optimized_data[field_id] = int(value[-2:])
                    
                    elif field_name == 'time':
                        # Convert to YYYYMMDD format
                        time_obj = datetime.strptime(value, "%y%m%d %H%M%S.0")
                        optimized_data[field_id] = int(time_obj.strftime("%Y%m%d"))
                    
                    elif field_name == 'cgi':
                        # Convert to array and apply modulo
                        parts = value.split('-')
                        if len(parts) >= 4:
                            optimized_data[field_id] = [
                                int(parts[0]) % 1000,
                                int(parts[1]) % 100,
                                int(parts[2]) % 100,
                                int(parts[3]) % 10000
                            ]
                        else:
                            optimized_data[field_id] = value
                    
                    elif field_name == 'acc':
                        # Convert to quantized array with reduced precision
                        acc_parts = value.split()
                        if len(acc_parts) >= 3:
                            optimized_data[field_id] = [
                                int(float(acc_parts[0]) * self.quantization_factors['acc']),
                                int(float(acc_parts[1]) * self.quantization_factors['acc']),
                                int(float(acc_parts[2]) * self.quantization_factors['acc'])
                            ]
                        else:
                            optimized_data[field_id] = value
                    
                    elif field_name in self.quantization_factors:
                        # Apply quantization to numeric fields
                        try:
                            float_val = float(value)
                            optimized_data[field_id] = int(float_val * self.quantization_factors[field_name])
                        except (ValueError, TypeError):
                            optimized_data[field_id] = value
                    
                    else:
                        # Keep original value for other fields
                        optimized_data[field_id] = value
            
            # Encode to CBOR
            cbor_data = cbor2.dumps(optimized_data)
            return cbor_data
            
        except Exception as e:
            print(f"❌ CBOR encoding failed: {e}")
            return None
    
    @task(3)
    def test_decoder_only(self):
        """Test decoder endpoint only (without Mobius)"""
        try:
            # Generate test payload
            sensor_data = self.generate_esp32_payload()
            cbor_data = self.encode_cbor(sensor_data)
            
            if not cbor_data:
                return
            
            # Send to decoder
            headers = {
                'Content-Type': 'application/octet-stream',
                'device-id': f"ESP32_{sensor_data['iso6346']}",
                'network-type': 'astrocast',
                'timestamp': datetime.now().isoformat()
            }
            
            with self.client.post(
                "/api/esp32-cbor",
                data=cbor_data,
                headers=headers,
                catch_response=True,
                name="decoder-only",
                timeout=10
            ) as response:
                if response.status_code == 200:
                    response.success()
                    print(f"✅ Decoder test successful - Size: {len(cbor_data)} bytes")
                elif response.status_code == 0:
                    response.failure("Connection failed (Status: 0)")
                    print(f"❌ Decoder connection failed - Check if decoder is running")
                else:
                    response.failure(f"Decoder returned {response.status_code}")
                    print(f"❌ Decoder test failed - Status: {response.status_code}")
                    
        except Exception as e:
            print(f"❌ Decoder test error: {e}")
    
    @task(2)
    def test_full_pipeline(self):
        """Test complete pipeline: Encoder -> Decoder -> Mobius"""
        try:
            # Generate test payload
            sensor_data = self.generate_esp32_payload()
            cbor_data = self.encode_cbor(sensor_data)
            
            if not cbor_data:
                return
            
            # Send to decoder (which will forward to Mobius)
            headers = {
                'Content-Type': 'application/octet-stream',
                'device-id': f"ESP32_{sensor_data['iso6346']}",
                'network-type': 'astrocast',
                'timestamp': datetime.now().isoformat(),
                'forward-to-mobius': 'true'  # Signal to forward to Mobius
            }
            
            with self.client.post(
                "/api/esp32-cbor",
                data=cbor_data,
                headers=headers,
                catch_response=True,
                name="full-pipeline",
                timeout=15
            ) as response:
                if response.status_code == 200:
                    response.success()
                    print(f"✅ Full pipeline test successful - Size: {len(cbor_data)} bytes")
                elif response.status_code == 0:
                    response.failure("Connection failed (Status: 0)")
                    print(f"❌ Pipeline connection failed - Check if decoder is running")
                else:
                    response.failure(f"Pipeline returned {response.status_code}")
                    print(f"❌ Full pipeline test failed - Status: {response.status_code}")
                    
        except Exception as e:
            print(f"❌ Full pipeline test error: {e}")
    
    @task(1)
    def test_health_check(self):
        """Test decoder health endpoint"""
        try:
            with self.client.get(
                "/health",
                catch_response=True,
                name="health-check"
            ) as response:
                if response.status_code == 200:
                    response.success()
                    print("✅ Health check successful")
                else:
                    response.failure(f"Health check returned {response.status_code}")
                    print(f"❌ Health check failed - Status: {response.status_code}")
                    
        except Exception as e:
            print(f"❌ Health check error: {e}")

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Called when test starts"""
    print("🚀 Maritime IoT Pipeline Load Test Starting...")
    print(f"📊 Target Decoder: {environment.host}")
    print(f"🎯 Test Configuration:")
    print(f"   - Users: {environment.runner.user_count if hasattr(environment.runner, 'user_count') else 'Dynamic'}")
    print(f"   - Spawn Rate: {environment.runner.spawn_rate if hasattr(environment.runner, 'spawn_rate') else 'Dynamic'}")
    print(f"   - Host: {environment.host}")

@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Called when test stops"""
    print("🏁 Maritime IoT Pipeline Load Test Completed!")
    print("📈 Check the Locust web interface for detailed results")

if __name__ == "__main__":
    print("🔧 Maritime IoT Pipeline Locust Test Script")
    print("Usage:")
    print("  locust -f locustfile.py --host=http://172.25.1.78:3001")
    print("  locust -f locustfile.py --host=http://172.25.1.78:3001 --users=10 --spawn-rate=2")
    print("  locust -f locustfile.py --host=http://172.25.1.78:3001 --users=20 --spawn-rate=5")
    print("  locust -f locustfile.py --host=http://172.25.1.78:3001 --users=30 --spawn-rate=10") 