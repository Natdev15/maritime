#!/usr/bin/env python3
"""
Setup script for Locust stress testing environment
Installs dependencies and validates the setup
"""

import subprocess
import sys
import os

def run_command(cmd, description):
    """Run a command and handle errors"""
    print(f"🔧 {description}...")
    try:
        result = subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed:")
        print(f"   Error: {e.stderr}")
        return False

def check_python_version():
    """Check if Python version is compatible"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 7):
        print(f"❌ Python {version.major}.{version.minor} detected")
        print("   Locust requires Python 3.7 or higher")
        return False
    else:
        print(f"✅ Python {version.major}.{version.minor} detected")
        return True

def install_dependencies():
    """Install required dependencies"""
    print("\n📦 Installing dependencies...")
    
    # Upgrade pip first
    if not run_command("python -m pip install --upgrade pip", "Upgrading pip"):
        return False
    
    # Install requirements
    if not run_command("pip install -r requirements_locust.txt", "Installing Locust dependencies"):
        return False
    
    return True

def validate_installation():
    """Validate that all dependencies are properly installed"""
    print("\n🔍 Validating installation...")
    
    try:
        import locust
        print(f"✅ Locust {locust.__version__} installed")
    except ImportError:
        print("❌ Locust not found")
        return False
    
    try:
        import cbor2
        print("✅ CBOR2 installed")
    except ImportError:
        print("❌ CBOR2 not found")
        return False
    
    try:
        import requests
        print(f"✅ Requests {requests.__version__} installed")
    except ImportError:
        print("❌ Requests not found")
        return False
    
    return True

def test_locust_command():
    """Test if locust command is available"""
    print("\n🧪 Testing Locust command...")
    
    try:
        result = subprocess.run(["locust", "--version"], capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print(f"✅ Locust command works: {result.stdout.strip()}")
            return True
        else:
            print(f"❌ Locust command failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Locust command test failed: {e}")
        return False

def create_test_script():
    """Create a simple test script to verify the setup"""
    test_script = """#!/usr/bin/env python3
\"\"\"
Quick test script to verify Locust setup
\"\"\"

import sys
import subprocess

def test_imports():
    \"\"\"Test if all required modules can be imported\"\"\"
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
    \"\"\"Test CBOR encoding functionality\"\"\"
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
        print("\\n🚀 You can now run load tests:")
        print("   python run_load_tests.py --scenario=light")
        print("   locust -f locustfile.py --host=http://172.25.1.78:3001")
    else:
        print("❌ Setup verification failed")
        sys.exit(1)
"""
    
    with open("test_setup.py", "w", encoding="utf-8") as f:
        f.write(test_script)
    
    print("✅ Test script created: test_setup.py")

def main():
    """Main setup function"""
    print("🚀 Maritime IoT Pipeline - Locust Setup")
    print("=" * 50)
    
    # Check Python version
    if not check_python_version():
        sys.exit(1)
    
    # Install dependencies
    if not install_dependencies():
        print("❌ Dependency installation failed")
        sys.exit(1)
    
    # Validate installation
    if not validate_installation():
        print("❌ Installation validation failed")
        sys.exit(1)
    
    # Test locust command
    if not test_locust_command():
        print("❌ Locust command test failed")
        sys.exit(1)
    
    # Create test script
    create_test_script()
    
    print("\n🎉 Setup completed successfully!")
    print("\n📋 Next steps:")
    print("1. Make sure your decoder is running on VM at http://172.25.1.78:3001")
    print("2. Run the test script: python test_setup.py")
    print("3. Start load testing:")
    print("   - Light load: python run_load_tests.py --scenario=light")
    print("   - Medium load: python run_load_tests.py --scenario=medium")
    print("   - Heavy load: python run_load_tests.py --scenario=heavy")
    print("   - All scenarios: python run_load_tests.py --scenario=all")
    print("4. Or run manually: locust -f locustfile.py --host=http://172.25.1.78:3001")

if __name__ == "__main__":
    main() 