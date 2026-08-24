### Task 4: Regenerate the frontend mirrors from source

**Files:**
- Modify via build: `gas-deploy/app.js`
- Modify via build: `gas-deploy/JavaScript.html`
- Do not modify: `gas-deploy/index.html`, `src/style.css`, `gas-deploy/style.css`, `gas-deploy/Style.html`

**Interfaces:**
- Consumes: `src/app.js`.
- Produces: a direct-copy `gas-deploy/app.js` and a `<script>`-wrapped `gas-deploy/JavaScript.html` containing exactly the same frontend logic.

- [ ] **Step 1: Run the repository build**

Run:

```powershell
npm run build
```

Expected: `build.js` reports successful creation of `JavaScript.html`, `gviz-service.html`, `Style.html`, and direct copies without error.

- [ ] **Step 2: Verify the direct mirror and wrapper content**

Run:

```powershell
node -e "const fs=require('fs'); const s=fs.readFileSync('src/app.js','utf8'); const d=fs.readFileSync('gas-deploy/app.js','utf8'); if (s!==d) throw new Error('gas-deploy/app.js is not synchronized'); const w=fs.readFileSync('gas-deploy/JavaScript.html','utf8'); const expected='<script>\n'+s+'\n</script>\n'; if (w!==expected) throw new Error('gas-deploy/JavaScript.html wrapper is not synchronized'); console.log('Frontend mirrors synchronized');"
```

Expected: `Frontend mirrors synchronized`.

- [ ] **Step 3: Confirm no unrelated CSS/HTML logic was changed**

Run:

```powershell
rg -n -S "form-purpose-other|setupBookingOtherWorkTypeField|workTypeOther" src\app.js gas-deploy\app.js gas-deploy\JavaScript.html gas-deploy\index.html
```

Expected: booking references appear only in the approved frontend locations and existing markup; no fuel IDs are changed.

