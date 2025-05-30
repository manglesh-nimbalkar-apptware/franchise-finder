FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the code
COPY . .

# Expose the port Vite dev server is running on 3000
EXPOSE 3000

# Run the dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
