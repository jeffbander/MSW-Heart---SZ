#!/usr/bin/env node
/**
 * Patches xlsx-populate to handle encrypted Excel files that use XML namespace prefixes.
 * Run automatically via "postinstall" in package.json.
 *
 * Two patches:
 * 1. XmlParser.js: Strip namespace prefixes (e.g., "x:sheets" -> "sheets")
 * 2. Encryptor.js:  Fall back to "encryptedKey" when "p:encryptedKey" is not found
 * 3. StyleSheet.js: Handle missing style nodes gracefully
 */
const fs = require('fs');
const path = require('path');

const LIB = path.join(__dirname, '..', 'node_modules', 'xlsx-populate', 'lib');

function patchFile(filePath, patches) {
  if (!fs.existsSync(filePath)) {
    console.log(`  SKIP ${path.basename(filePath)} (not found)`);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  let applied = 0;
  for (const [search, replace] of patches) {
    if (content.includes(replace)) {
      // Already patched
      continue;
    }
    if (content.includes(search)) {
      content = content.replace(search, replace);
      applied++;
    }
  }
  if (applied > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`  PATCHED ${path.basename(filePath)} (${applied} change${applied > 1 ? 's' : ''})`);
  } else {
    console.log(`  OK ${path.basename(filePath)} (already patched or no changes needed)`);
  }
}

console.log('Patching xlsx-populate for namespace-prefixed XML...');

// 1. XmlParser.js — strip namespace prefixes from element names
patchFile(path.join(LIB, 'XmlParser.js'), [
  [
    `const child = { name: node.name, attributes: {}, children: [] };`,
    `// Strip namespace prefix (e.g. "x:sheets" -> "sheets")
                const _stripNS = n => { const i = n ? n.indexOf(':') : -1; return i >= 0 ? n.substring(i + 1) : n; };
                const child = { name: _stripNS(node.name), attributes: {}, children: [] };`
  ]
]);

// 2. Encryptor.js — fall back to "encryptedKey" without prefix
patchFile(path.join(LIB, 'Encryptor.js'), [
  [
    `const encryptedKeyNode = xmlq.findChild(keyEncryptorNode, "p:encryptedKey");`,
    `const encryptedKeyNode = xmlq.findChild(keyEncryptorNode, "p:encryptedKey") || xmlq.findChild(keyEncryptorNode, "encryptedKey");`
  ]
]);

// 3. StyleSheet.js — create missing style nodes
patchFile(path.join(LIB, 'StyleSheet.js'), [
  [
    `        // Remove the optional counts so we don't have to keep them up to date.
        delete this._numFmtsNode.attributes.count;
        delete this._fontsNode.attributes.count;
        delete this._fillsNode.attributes.count;
        delete this._bordersNode.attributes.count;
        delete this._cellXfsNode.attributes.count;`,
    `        // Create missing style nodes if needed (some encrypted files may lack them)
        if (!this._fontsNode) { this._fontsNode = { name: "fonts", attributes: {}, children: [] }; this._node.children.push(this._fontsNode); }
        if (!this._fillsNode) { this._fillsNode = { name: "fills", attributes: {}, children: [] }; this._node.children.push(this._fillsNode); }
        if (!this._bordersNode) { this._bordersNode = { name: "borders", attributes: {}, children: [] }; this._node.children.push(this._bordersNode); }
        if (!this._cellXfsNode) { this._cellXfsNode = { name: "cellXfs", attributes: {}, children: [] }; this._node.children.push(this._cellXfsNode); }

        // Remove the optional counts so we don't have to keep them up to date.
        delete this._numFmtsNode.attributes.count;
        delete this._fontsNode.attributes.count;
        delete this._fillsNode.attributes.count;
        delete this._bordersNode.attributes.count;
        delete this._cellXfsNode.attributes.count;`
  ]
]);

console.log('Done.');
