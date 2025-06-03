FROM python:3.11-slim

WORKDIR /app

# Install browser dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxtst6 \
    xauth \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Set environment variables for Chrome
ENV CHROME_BIN=/usr/bin/chromium \
    CHROMIUM_PATH=/usr/bin/chromium \
    CHROME_PATH=/usr/bin/chromium

RUN pip install --upgrade playwright
RUN playwright install chromium --with-deps --no-shell

# Copy the rest of the application
COPY . .

# Set environment variables for debugging
ENV DEBUG=pw:api
ENV BROWSER_USE_DEBUG=true

# Expose the port the app runs on
EXPOSE 8080

# Run the application
CMD ["python", "app.py"]
