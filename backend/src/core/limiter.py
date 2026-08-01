from slowapi import Limiter
from slowapi.util import get_remote_address

# Client ke IP address ke basis par requests track hongi
limiter = Limiter(key_func=get_remote_address)