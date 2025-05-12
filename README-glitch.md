# BizXM Signaling Server

This is a WebRTC signaling server for the BizXM desktop application, designed to be hosted on Glitch.

## What This Server Does

This server facilitates WebRTC connections between BizXM clients by:

1. Managing room creation and joining
2. Handling WebRTC signaling (exchanging ICE candidates and SDP offers/answers)
3. Managing participants in rooms
4. Tracking screen sharing status

## Setup Instructions

### 1. On Glitch.com

1. Sign in to Glitch.com
2. Create a new project by importing from GitHub
3. Use the repository URL: `https://github.com/bsyilmaz/bizxm.git`
4. Glitch will automatically detect the Glitch configuration and start the server

### 2. In Your BizXM App

1. Open `public/renderer.js`
2. Update the `SIGNALING_SERVERS` array with your Glitch URL:
   ```js
   const SIGNALING_SERVERS = [
     'https://your-project-name.glitch.me',  // Replace with your actual Glitch URL
     'http://localhost:3001',
     // ... other fallback servers
   ];
   ```
3. Rebuild the application for all platforms

## File Structure

- `server.js` - The main signaling server
- `package.json` - Dependencies and script configuration
- `glitch.json` - Glitch-specific configuration

## Important Notes

- The server will automatically clean up inactive rooms after 1 hour
- Server uses port 3000 by default, but Glitch will handle port mapping
- All communication is protected with CORS headers
- The server provides a simple status page at the root URL

## Troubleshooting

If connections fail:
1. Verify your Glitch server is running by visiting your Glitch URL
2. Check that the Glitch URL in the BizXM app is correct
3. Ensure STUN/TURN servers are configured correctly in the app

## License

MIT 