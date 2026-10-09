const fs = require('node:fs');
const path = require('node:path');
const template = fs.readFileSync(path.join(__dirname, 'demo-template.html'), 'utf8');
// Expose the shadow tree only in the presentation fixture for browser automation.
const banner = fs.readFileSync(path.join(__dirname, '../tab-volume/banner.js'), 'utf8')
  .replace("attachShadow({mode: 'closed'})", "attachShadow({mode: 'open'})");
fs.writeFileSync(path.join(__dirname, 'demo.html'), template.replace('/* BANNER_SOURCE */', banner));
console.log('Created docs/demo.html. Serve locally to reproduce the presentation screenshots.');
