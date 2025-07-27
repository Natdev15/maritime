#!/usr/bin/env python3
"""
Quick test script to verify Locust setup
"""

import sys
import subprocess

def test_imports():
    """Test if all required modules can be imported"""
    try:
        import locust
        import cbor2
        import requests
        print("✅ All imports successful")
        return True
    except ImportError as e:
        print(f"❌ Import failed: {e}")
        return False

def test_cbor_encoding():
    """Test CBOR encoding functionality"""
    try:
        import cbor2
        test_data = {"test": "value", "number": 42}
        encoded = cbor2.dumps(test_data)
        decoded = cbor2.loads(encoded)
        assert decoded == test_data
        print("✅ CBOR encoding/decoding works")
        return True
    except Exception as e:
        print(f"❌ CBOR test failed: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Running Locust setup verification...")
    
    if test_imports() and test_cbor_encoding():
        print("🎉 Setup verification successful!")
        print("\n🚀 You can now run load tests:")
        print("   python run_load_tests.py --scenario=light")
        print("   locust -f locustfile.py --host=http://172.25.1.78:3001")
    else:
        print("❌ Setup verification failed")
        sys.exit(1)
