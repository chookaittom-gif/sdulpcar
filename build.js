const fs = require('fs');
const path = require('path');

try {
  console.log('🚀 Start building assets...');

  // 1. สร้างโฟลเดอร์ปลายทางถ้าไม่มี
  const destDir = path.join(__dirname, 'gas-deploy');
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // 2. ฟังก์ชันช่วยหุ้มแท็กและบันทึกไฟล์
  const wrapAndSave = (srcPath, destPath, tagName) => {
    const content = fs.readFileSync(path.join(__dirname, srcPath), 'utf8');
    const wrapped = `<${tagName}>\n${content}\n</${tagName}>`;
    fs.writeFileSync(path.join(destDir, destPath), wrapped, 'utf8');
    console.log(`✅ Created wrapped: ${destPath}`);
  };

  // 3. ฟังก์ชันช่วยคัดลอกไฟล์ตรงๆ
  const copyDirect = (srcPath, destPath) => {
    const content = fs.readFileSync(path.join(__dirname, srcPath), 'utf8');
    fs.writeFileSync(path.join(destDir, destPath), content, 'utf8');
    console.log(`✅ Copied direct: ${destPath}`);
  };

  // 4. บิวด์หุ้มสำหรับ Google Apps Script
  wrapAndSave('src/app.js', 'JavaScript.html', 'script');
  wrapAndSave('src/gviz-service.js', 'gviz-service.html', 'script');
  wrapAndSave('src/style.css', 'Style.html', 'style');

  // 5. คัดลอกโดยตรงสำหรับ Netlify Static Site
  copyDirect('src/app.js', 'app.js');
  copyDirect('src/style.css', 'style.css');
  copyDirect('src/config.js', 'config.js');
  copyDirect('src/gviz-service.js', 'gviz-service.js');

  console.log('🎉 Build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
