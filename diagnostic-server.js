const express = require('express');
const path = require('path');
const app = express();

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>JediCare - Diagnostic</title>
      <link rel="stylesheet" href="/css/styles.css">
      <style>
        body { font-family: Arial; padding: 20px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        .warning { background: #fff3cd; color: #856404; }
      </style>
    </head>
    <body>
      <h1>JediCare Diagnostic Page</h1>
      
      <div class="status success">
        ✅ Express server is running
      </div>
      
      <div id="css-status" class="status warning">
        🔄 Testing CSS...
      </div>
      
      <div id="js-status" class="status warning">
        🔄 Testing JS...
      </div>
      
      <h2>Test Results:</h2>
      <pre id="results">Running tests...</pre>
      
      <script src="/js/main.js"></script>
      <script>
        // Test CSS loading
        const cssStatus = document.getElementById('css-status');
        const jsStatus = document.getElementById('js-status');
        const results = document.getElementById('results');
        
        // Test CSS
        const cssLink = document.querySelector('link[href="/css/styles.css"]');
        if (cssLink) {
          cssLink.onload = () => {
            cssStatus.innerHTML = '✅ CSS loaded successfully';
            cssStatus.className = 'status success';
            updateResults();
          };
          cssLink.onerror = () => {
            cssStatus.innerHTML = '❌ CSS failed to load';
            cssStatus.className = 'status error';
            updateResults();
          };
        }
        
        // Test JS
        window.jsLoaded = false;
        setTimeout(() => {
          if (window.jsLoaded) {
            jsStatus.innerHTML = '✅ JS loaded successfully';
            jsStatus.className = 'status success';
          } else {
            jsStatus.innerHTML = '❌ JS failed to load or no window.jsLoaded set';
            jsStatus.className = 'status error';
          }
          updateResults();
        }, 1000);
        
        function updateResults() {
          results.textContent = JSON.stringify({
            timestamp: new Date().toISOString(),
            css: cssStatus.textContent,
            js: jsStatus.textContent,
            userAgent: navigator.userAgent,
            location: window.location.href
          }, null, 2);
        }
      </script>
    </body>
    </html>
  `);
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Diagnostic server on http://localhost:${PORT}`);
  });
}