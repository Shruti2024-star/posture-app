const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 5000;

// Enable CORS for frontend
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Setup storage for uploaded videos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({ storage });

// Upload endpoint
app.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  res.json({ url: `/uploads/${req.file.filename}` });
});

//Store analysis result
app.post('/save-result', (req, res) => {
  console.log('Received posture result:', req.body);
  res.json({ message: 'Result saved (not actually writing to DB)' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});



