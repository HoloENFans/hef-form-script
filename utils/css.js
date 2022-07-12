const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.resolve(__dirname, '../styles/output.css')).toString();
const str = `
<style>
${css}
</style>
`;

fs.writeFileSync(path.resolve(__dirname, '../views/Stylesheet.html'), str);
