FROM node:20-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install any needed packages
RUN npm install

# Bundle app source
COPY . .

# Create a volume for the database
VOLUME /usr/src/app

# The command to run the application
CMD [ "node", "index.js" ]
