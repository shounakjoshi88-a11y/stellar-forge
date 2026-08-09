FROM oven/bun:1.2

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --production

# Copy source
COPY . .

# Expose port
EXPOSE 3001

# Start the server
CMD ["bun", "src/index.ts"]
