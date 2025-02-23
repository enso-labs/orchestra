from cryptography.fernet import Fernet
key = Fernet.generate_key()
print(key.decode())  # Add this to your environment variables as TOKEN_ENCRYPTION_KEY
