# BizXM Glitch Server Setup

This document explains how to set up a Glitch server for BizXM to enable WebRTC connectivity between different networks.

## Why Use Glitch?

When running BizXM on computers in different networks, a signaling server accessible from the internet is needed to establish WebRTC connections. Glitch provides free hosting for Node.js applications, making it perfect for our signaling server.

## Setup Instructions

### 1. Create a Glitch Account

1. Go to [Glitch.com](https://glitch.com/) and sign up for a free account
2. Click on "New Project" and select "Import from GitHub"
3. Enter the repository URL: `https://github.com/bsyilmaz/bizxm.git`
4. Wait for the project to be imported

### 2. Configure Your Glitch Project

#### Automatic Setup (Recommended)

1. After importing, Glitch will set up your project
2. Click on the project name in the top-left corner to rename it to something memorable
3. In the Glitch editor, navigate to the `glitch-files` directory
4. Open the Terminal in Glitch (Tools > Terminal)
5. Run the following commands:
   ```
   cd glitch-files
   node setup.js
   ```
6. The script will automatically copy all necessary files to your project root

#### Manual Setup (Alternative)

If the automatic setup doesn't work:

1. In the Glitch editor, navigate to the `glitch-files` directory
2. Copy these files to the root of your Glitch project:
   - `server.js`
   - `package.json`
   - `glitch.json`
   - `README.md`

### 3. Test Your Glitch Server

1. The server should automatically start running
2. Click on "Share" button in the top-right corner
3. Copy the "Live Site" URL (e.g., `https://your-project-name.glitch.me`)
4. Visit this URL in your browser to verify the server is running

### 4. Update Your BizXM Application

1. Open `public/renderer.js` in your local BizXM project
2. Find the `SIGNALING_SERVERS` array (around line 40)
3. Replace the first URL with your Glitch URL:

```javascript
const SIGNALING_SERVERS = [
  'https://your-project-name.glitch.me',  // Replace with your actual Glitch URL
  'http://localhost:3001',
  'http://192.168.0.24:3001'
];
```

4. Save the file and rebuild your application:
   - For Mac: `npm run build:mac`
   - For Windows: `npm run build:win`

### 5. Share Your Application

1. Distribute the updated application to users
2. Both users should now be able to connect through the Glitch server, even across different networks

## Additional Information

### Keeping Your Glitch Server Awake

Glitch free tier projects go to sleep after 5 minutes of inactivity. To keep your server awake:

1. Use a service like [UptimeRobot](https://uptimerobot.com/) to ping your Glitch URL every 5 minutes
2. Create a free account on UptimeRobot
3. Add a new monitor with the HTTP(S) type
4. Enter your Glitch URL and set the monitoring interval to 5 minutes

### Troubleshooting

If you experience connection issues:

1. Verify your Glitch server is running by visiting its URL
2. Check that you've correctly updated the `SIGNALING_SERVERS` array in your application
3. Ensure your STUN/TURN servers are properly configured in the WebRTC configuration
4. Check the browser console for any error messages

### Security Considerations

The free Glitch server is suitable for testing and personal use but has limitations:

- No SSL certificate management
- Limited bandwidth and computing resources
- Project sleeps after inactivity (unless pinged)

For production use, consider deploying the signaling server to a dedicated hosting service like Heroku, DigitalOcean, or AWS. 