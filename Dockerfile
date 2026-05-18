FROM node:18-bullseye

# Install Python and dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm install --production

# Copy Python requirements
COPY requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY server.js ./
COPY mealParser.js ./
COPY generate_meal_images.py ./

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
