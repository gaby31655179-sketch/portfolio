// GitHub rebuilds the public site after each content change. No packages needed.
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const output = path.join(root, '_site');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const profile = read('data/resume.json');
const {projects} = read('data/projects.json');
if(!profile || typeof profile !== 'object' || Array.isArray(profile)) throw new Error('履歷資料格式不正確');
if(!Array.isArray(projects)) throw new Error('作品資料必須是清單');
function assertStrings(object, fields) {
  if(!object || typeof object !== 'object' || Array.isArray(object)) throw new Error('內容必須是物件');
  for(const field of fields) if(object[field] != null && typeof object[field] !== 'string') throw new Error(`${field} 必須是文字`);
}
assertStrings(profile, ['name','englishName','title','education','research','experience','skills','email','resumeUrl']);
if(!profile.name || !profile.name.trim()) throw new Error('請填入履歷姓名');
for(const project of projects) {
  assertStrings(project, ['title','description','url','file','image']);
  if(!project.title || !project.title.trim()) throw new Error('請填入作品名稱');
}
function assertUpload(value) {
  if(!value || !value.startsWith('/uploads/') && !value.startsWith('uploads/')) return;
  const normalized = value.replace(/^\//, '');
  const resolved = path.resolve(root, normalized);
  const uploadRoot = path.join(root, 'uploads') + path.sep;
  if(!resolved.startsWith(uploadRoot) || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) throw new Error(`上傳檔案不存在或路徑不正確：${value}`);
}
assertUpload(profile.resumeUrl);
for(const project of projects) { assertUpload(project.file); assertUpload(project.image); }
// Clean only this build's output; reject symbolic links or an unexpected path.
if(path.dirname(output) !== root || path.basename(output) !== '_site') throw new Error('Invalid build directory');
if(fs.existsSync(output)) {
  if(fs.lstatSync(output).isSymbolicLink()) throw new Error('Build directory cannot be a symlink');
  fs.rmSync(output, {recursive:true});
}
fs.mkdirSync(output);
const payload = JSON.stringify({profile, projects}).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if(!html.includes('<!-- CONTENT_DATA -->')) throw new Error('Content marker missing');
html = html.replace('<!-- CONTENT_DATA -->', () => `<script>window.PORTFOLIO_CONTENT=${payload};</script>`);
fs.writeFileSync(path.join(output, 'index.html'), html);
fs.writeFileSync(path.join(output, '.nojekyll'), '');
fs.mkdirSync(path.join(output, 'admin'));
fs.copyFileSync(path.join(root, 'admin/index.html'), path.join(output, 'admin/index.html'));
fs.cpSync(path.join(root, 'uploads'), path.join(output, 'uploads'), {
  recursive:true,
  filter:source => {
    if(fs.lstatSync(source).isSymbolicLink()) throw new Error('Upload symlinks are not supported');
    return path.basename(source) !== '.gitkeep';
  }
});
console.log(`Built _site with ${projects.length} projects.`);
