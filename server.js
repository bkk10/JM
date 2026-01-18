// server.js - VERCEL COMPATIBLE VERSION
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const fs = require('fs');

const app = express();

// ==================== CONFIGURATION ====================
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(expressLayouts);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files BEFORE any other middleware
app.use('/css', express.static(path.join(__dirname, 'public/css'), {
  maxAge: '1y',
  setHeaders: (res, path) => {
    res.setHeader('Content-Type', 'text/css');
  }
}));

app.use('/js', express.static(path.join(__dirname, 'public/js'), {
  maxAge: '1y',
  setHeaders: (res, path) => {
    res.setHeader('Content-Type', 'application/javascript');
  }
}));

app.use('/images', express.static(path.join(__dirname, 'public/images'), {
  maxAge: '1y'
}));

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads'), {
  maxAge: '1y'
}));

// Also serve from root public folder
app.use(express.static(path.join(__dirname, 'public')));

// Simple session simulation
let adminLoggedIn = false;

// ==================== DATABASE ====================
// For Vercel, use in-memory database or create DB file in /tmp
const dbPath = process.env.VERCEL ? '/tmp/jedimedical.db' : './data/jedimedical.db';

// Create data directory if it doesn't exist (for local)
if (!process.env.VERCEL && !fs.existsSync('./data')) {
  fs.mkdirSync('./data', { recursive: true });
}

const db = new sqlite3.Database(dbPath);
// Initialize tables
db.serialize(() => {
  // Content table
  db.run(`CREATE TABLE IF NOT EXISTS gallery_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    caption TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Blog posts table
  db.run(`CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    excerpt TEXT,
    author TEXT DEFAULT 'Admin',
    status TEXT DEFAULT 'published',
    featured_image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Add featured_image column if it doesn't exist
  db.run(`ALTER TABLE blog_posts ADD COLUMN featured_image TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding featured_image column:', err);
    }
  });

  // Content table
  db.run(`CREATE TABLE IF NOT EXISTS content (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  // Section images table
  db.run(`CREATE TABLE IF NOT EXISTS section_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section TEXT NOT NULL,
    filename TEXT NOT NULL,
    caption TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Analytics tables
  db.run(`CREATE TABLE IF NOT EXISTS site_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT,
    user_agent TEXT,
    page_visited TEXT,
    referrer TEXT,
    visit_date DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS contact_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    phone TEXT,
    message TEXT,
    submission_date DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Default content
  const defaultContent = {
    'hero_kicker': 'Level 3 • Kapsoya, Ainabkoi · Uasin Gishu',
    'hero_title': 'Healthcare that feels personal—delivered with precision.',
    'hero_intro': 'JediCare Medical centre is a trusted Level 3 clinic serving families and professionals in Kapsoya. We combine experienced clinicians with modern diagnostics and patient-first service. Our optician desk helps you see better—with frames you will love.',
    'hero_badge1': 'Open and fully operational',
    'hero_badge2': 'Modern diagnostics & imaging',
    'hero_badge3': 'Optician services & prescription glasses',
    'hero_badge4': 'Powered by EasyClinic operations',
    'why_title': 'Why patients choose Jedi',
    'why_card1_title': 'Experienced Team',
    'why_card1_body': 'Clinicians with broad hands-on experience, focused on practical, effective care.',
    'why_card2_title': 'Modern Equipment',
    'why_card2_body': 'From labs to imaging, we invest in tools that improve accuracy and outcomes.',
    'why_card3_title': 'Clean & Safe',
    'why_card3_body': 'Strict hygiene protocols for a calm, safe environment at every visit.',
    'about_title': 'About Jedi Medical',
    'about_body1': 'JediCare Medical centre is a Level 3 clinic recognized for precise, patient-centered care. We serve the Kapsoya ward in Ainabkoi constituency, Uasin Gishu, with an experienced team and a calm, well-kept facility. Our approach blends practical medicine with modern diagnostics—so you feel informed and supported at every step.',
    'about_body2': 'With EasyClinic helping streamline operations, we stay focused on what matters most: your care, your comfort, and dependable outcomes.',
    'contact_title': 'Book an Appointment',
    'contact_intro': 'Looking for a reliable private clinic near you in Uasin Gishu? JediCare Medical centre is open and ready to help. Reach out and our team will guide you to the right service, including our in-house optician desk for prescriptions and glasses.',
    'contact_note': 'Prefer a call? Add your phone number—we will get back promptly.'
  };

  for (const [key, value] of Object.entries(defaultContent)) {
    db.run(`INSERT OR IGNORE INTO content (key, value) VALUES (?, ?)`, [key, value]);
  }

  // Default blog posts (for fresh deployments)
  const defaultBlogPosts = [
    {
      title: 'Preventive healthcare',
      slug: 'preventive-healthcare',
      excerpt: '5 Essential Preventive Health Checks',
      content: 'Discover key health screenings for early detection and better health. Regular preventive care is the foundation of long-term wellness and can catch potential health issues before they become serious problems.',
      author: 'Admin',
      status: 'published'
    },
    {
      title: 'Eye care',
      slug: 'eye-care',
      excerpt: 'Protecting Your Vision',
      content: 'Learn strategies to reduce digital eye strain and maintain healthy vision. In today\'s digital world, protecting your eyes is more important than ever. Our comprehensive eye care services help you maintain optimal vision health.',
      author: 'Admin',
      status: 'published'
    },
    {
      title: 'Child health',
      slug: 'child-health',
      excerpt: 'Children\'s Health Foundation',
      content: 'Essential healthcare tips for children\'s development and wellbeing. From vaccinations to growth monitoring, we provide comprehensive pediatric care to ensure your children grow up healthy and strong.',
      author: 'Admin',
      status: 'published'
    }
  ];

  // Insert default blog posts if table is empty
  db.get('SELECT COUNT(*) as count FROM blog_posts', (err, row) => {
    if (!err && row.count === 0) {
      defaultBlogPosts.forEach(post => {
        db.run(`INSERT INTO blog_posts (title, slug, excerpt, content, author, status) VALUES (?, ?, ?, ?, ?, ?)`,
          [post.title, post.slug, post.excerpt, post.content, post.author, post.status]);
      });
    }
  });
});

app.locals.db = db;

// ==================== FILE UPLOAD ====================
// VERCEL FIX: Use memory storage instead of disk storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// ==================== SIMPLE AUTH ====================
const ADMIN_PASSWORD = 'admin123';

const requireAuth = (req, res, next) => {
  if (adminLoggedIn) {
    return next();
  }
  res.redirect('/admin/login');
};

// Helper functions (keep your existing ones)
function getAllContent() {
  return new Promise((resolve, reject) => {
    db.all('SELECT key, value FROM content', (err, rows) => {
      if (err) reject(err);
      const content = {};
      rows.forEach(row => content[row.key] = row.value);
      resolve(content);
    });
  });
}


function getSectionImages() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM section_images ORDER BY section, created_at DESC',
      (err, rows) => {
        if (err) reject(err);
        
        // Group by section
        const imagesBySection = {};
        rows.forEach(img => {
          if (!imagesBySection[img.section]) {
            imagesBySection[img.section] = [];
          }
          imagesBySection[img.section].push(img);
        });
        
        resolve(imagesBySection);
      });
  });
}

async function renderWithLayout(res, view, data = {}, layout = 'layout') {
  try {
    data.currentYear = new Date().getFullYear();
    
    // Remove this duplicate footer logic if it exists
    // Just render directly without nested rendering
    
    res.render(view, { 
      ...data, 
      layout: false // IMPORTANT: Don't use express-ejs-layouts for main render
    }, (err, html) => {
      if (err) {
        console.error('Render error:', err);
        return res.status(500).send('Render error');
      }
      
      // Now render with layout
      res.render(layout, { 
        ...data, 
        body: html,
        layout: false 
      });
    });
  } catch (error) {
    console.error('Render with layout error:', error);
    res.status(500).send('Server error');
  }
}

// ==================== ANALYTICS MIDDLEWARE ====================
app.use((req, res, next) => {
  if (!req.path.startsWith('/admin') && !req.path.startsWith('/css') && 
      !req.path.startsWith('/js') && !req.path.startsWith('/uploads')) {
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
    
    db.run(`INSERT INTO site_visits (ip_address, user_agent, page_visited, referrer) VALUES (?, ?, ?, ?)`, [
      clientIP,
      req.headers['user-agent'] || '',
      req.path,
      req.headers['referer'] || ''
    ]);
  }
  next();
});
// ==================== PUBLIC ROUTES ====================

// Home page (SINGLE PAGE with all sections)
// Home page (SINGLE PAGE with all sections)
// Home page - SIMPLIFIED
app.get('/', async (req, res) => {
  try {
    const content = await getAllContent();
    
    // Get gallery images for preview
    const galleryImages = await new Promise(resolve => {
      db.all('SELECT * FROM gallery_images ORDER BY created_at DESC LIMIT 6',
        (err, rows) => resolve(rows || []));
    });

    // Get blog posts for preview
    const blogPosts = await new Promise(resolve => {
      db.all('SELECT * FROM blog_posts WHERE status = "published" ORDER BY created_at DESC LIMIT 3',
        (err, rows) => resolve(rows || []));
    });

    // Get section images for hero section
    const imagesBySection = await getSectionImages();
    
    // DIRECT RENDER - no complex wrapper
    res.render('index', {
      content,
      galleryImages,
      blogPosts,
      imagesBySection,
      active: 'home',
    });
  } catch (error) {
    console.error('Home error:', error);
    res.status(500).send('Server error');
  }
});

// Gallery page
app.get('/gallery', async (req, res) => {
  try {
    const content = await getAllContent();
    const images = await new Promise(resolve => {
      db.all('SELECT * FROM gallery_images ORDER BY created_at DESC',
        (err, rows) => resolve(rows || []));
    });
    
    renderWithLayout(res, 'gallery', {
      content,
      images,
      active: 'gallery'
    });
  } catch (error) {
    console.error('Gallery error:', error);
    res.status(500).send('Server error');
  }
});

// Separate Blog page
app.get('/blog', async (req, res) => {
  try {
    const content = await getAllContent();
    const posts = await new Promise(resolve => {
      db.all('SELECT * FROM blog_posts WHERE status = "published" ORDER BY created_at DESC',
        (err, rows) => resolve(rows || []));
    });
    
    // Get section images for blog featured images
    const imagesBySection = await getSectionImages();
    
    renderWithLayout(res, 'blog', {
      content,
      posts,
      imagesBySection,
      active: 'blog'
    });
  } catch (error) {
    console.error('Blog error:', error);
    res.status(500).send('Server error');
  }
});

// Single blog post
app.get('/blog/:slug', async (req, res) => {
  try {
    const post = await new Promise(resolve => {
      db.get('SELECT * FROM blog_posts WHERE slug = ? AND status = "published"', [req.params.slug],
        (err, row) => resolve(row || null));
    });
    
    if (!post) {
      return res.status(404).send('Blog post not found');
    }
    
    const content = await getAllContent();
    
    renderWithLayout(res, 'blog-post', {
      content,
      post,
      active: 'blog'
    });
  } catch (error) {
    console.error('Blog post error:', error);
    res.status(500).send('Server error');
  }
});

// Contact form submission
app.post('/contact', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    
    await new Promise((resolve, reject) => {
      db.run(`INSERT INTO contact_submissions (name, email, phone, message) VALUES (?, ?, ?, ?)`, 
        [name, email, phone, message], (err) => {
          if (err) reject(err);
          else resolve();
        });
    });
    
    res.redirect('/#contact?success=1');
  } catch (error) {
    console.error('Contact form error:', error);
    res.redirect('/#contact?error=1');
  }
});

// ==================== ADMIN ROUTES (Keep as is) ====================
// Admin login
app.get('/admin/login', (req, res) => {
  if (adminLoggedIn) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', { error: null, layout: false });
});

app.post('/admin/login', async (req, res) => {
  try {
    const { password } = req.body;
    
    if (password === ADMIN_PASSWORD) {
      adminLoggedIn = true;
      return res.redirect('/admin/dashboard');
    }
    
    res.render('admin/login', { error: 'Invalid password', layout: false });
  } catch (error) {
    console.error('Login error:', error);
    res.render('admin/login', { error: 'Server error', layout: false });
  }
});

// Admin logout
app.post('/admin/logout', (req, res) => {
  adminLoggedIn = false;
  res.redirect('/admin/login');
});

// Admin dashboard
app.get('/admin/dashboard', requireAuth, async (req, res) => {
  try {
    const imagesCount = await new Promise(resolve => {
      db.get('SELECT COUNT(*) as count FROM gallery_images', 
        (err, row) => resolve(row ? row.count : 0));
    });
    
    const postsCount = await new Promise(resolve => {
      db.get('SELECT COUNT(*) as count FROM blog_posts', 
        (err, row) => resolve(row ? row.count : 0));
    });
    
    const totalVisits = await new Promise(resolve => {
      db.get('SELECT COUNT(*) as count FROM site_visits', 
        (err, row) => resolve(row ? row.count : 0));
    });
    
    res.render('admin/dashboard-sidebar', {
      title: 'Dashboard',
      counts: {
        services: 6,
        posts: postsCount,
        images: imagesCount,
        team: 0,
        visits: totalVisits,
        todayVisits: 0,
        contacts: 0
      },
      recentImages: [],
      heroImages: [],
      recentContacts: [],
      popularPages: [],
      active: 'dashboard',
      layout: 'admin/layout-sidebar'
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Server error');
  }
});

// Other admin routes (keep your existing ones)
app.get('/admin/content', requireAuth, async (req, res) => {
  const content = await getAllContent();
  res.render('admin/content-sidebar', {
    title: 'Edit Content',
    content,
    active: 'content',
    layout: 'admin/layout-sidebar'
  });
});

app.post('/admin/content', requireAuth, async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      db.run(`INSERT OR REPLACE INTO content (key, value) VALUES (?, ?)`,
        [key, value]);
    }
    res.redirect('/admin/content?success=1');
  } catch (error) {
    console.error('Save content error:', error);
    res.redirect('/admin/content?error=1');
  }
});

// Section images management
app.get('/admin/section-images', requireAuth, async (req, res) => {
  try {
    const sectionImages = await new Promise(resolve => {
      db.all('SELECT * FROM section_images ORDER BY section, created_at DESC',
        (err, rows) => resolve(rows || []));
    });
    
    const imagesBySection = {};
    sectionImages.forEach(img => {
      if (!imagesBySection[img.section]) {
        imagesBySection[img.section] = [];
      }
      imagesBySection[img.section].push(img);
    });
    
    res.render('admin/section-images-sidebar', {
      title: 'Section Images Management',
      imagesBySection,
      active: 'section-images',
      layout: 'admin/layout-sidebar'
    });
  } catch (error) {
    console.error('Section images error:', error);
    res.status(500).send('Server error');
  }
});

app.post('/admin/section-images/upload', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { section, caption } = req.body;
    if (req.file && section) {
      db.run(`INSERT INTO section_images (section, filename, caption) VALUES (?, ?, ?)`,
        [section, req.file.filename, caption || '']);
    }
    res.redirect('/admin/section-images?success=1');
  } catch (error) {
    console.error('Upload section image error:', error);
    res.redirect('/admin/section-images?error=1');
  }
});

// Gallery management
app.get('/admin/gallery', requireAuth, async (req, res) => {
  try {
    const images = await new Promise(resolve => {
      db.all('SELECT * FROM gallery_images ORDER BY created_at DESC',
        (err, rows) => resolve(rows || []));
    });
    
    res.render('admin/gallery-sidebar', {
      title: 'Gallery Management',
      images,
      success: req.query.success,
      error: req.query.error,
      active: 'gallery',
      layout: 'admin/layout-sidebar'
    });
  } catch (error) {
    console.error('Gallery error:', error);
    res.status(500).send('Server error');
  }
});

// Gallery upload
app.post('/admin/gallery/upload', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { caption } = req.body;
    if (req.file) {
      db.run(`INSERT INTO gallery_images (filename, caption) VALUES (?, ?)`,
        [req.file.filename, caption || '']);
    }
    res.redirect('/admin/gallery?success=1');
  } catch (error) {
    console.error('Upload error:', error);
    res.redirect('/admin/gallery?error=Upload failed');
  }
});

// Gallery delete
app.post('/admin/gallery/delete/:id', requireAuth, async (req, res) => {
  try {
    db.run('DELETE FROM gallery_images WHERE id = ?', [req.params.id]);
    res.redirect('/admin/gallery?success=1');
  } catch (error) {
    console.error('Delete error:', error);
    res.redirect('/admin/gallery?error=Delete failed');
  }
});

// Blog management routes (keep your existing ones)
app.get('/admin/blog', requireAuth, async (req, res) => {
  const posts = await new Promise(resolve => {
    db.all('SELECT * FROM blog_posts ORDER BY created_at DESC',
      (err, rows) => resolve(rows || []));
  });
  
  console.log('Admin blog posts loaded:', posts.length, 'posts');
  
  res.render('admin/blog', {
    title: 'Blog Management',
    posts,
    active: 'blog',
    layout: 'admin/layout-sidebar'
  });
});

app.get('/admin/blog/new', requireAuth, async (req, res) => {
  try {
    res.render('admin/blog-new', {
      title: 'New Blog Post - Admin',
      active: 'blog'
    });
  } catch (error) {
    console.error('Error loading new blog page:', error);
    res.redirect('/admin/blog?error=Cannot load new post form');
  }
});

app.post('/admin/blog/create', requireAuth, async (req, res) => {
  try {
    const { title, slug, author, excerpt, content, featured_image, status } = req.body;
    
    if (!title || !author || !content) {
      return res.redirect('/admin/blog/new?error=Title, Author, and Content are required');
    }
    
    // Generate slug from title if empty
    let postSlug = slug;
    if (!postSlug || postSlug.trim() === '') {
      postSlug = title.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/--+/g, '-')
        .trim();
    }
    
    // Check if slug already exists
    const existingPost = await new Promise(resolve => {
      db.get('SELECT id FROM blog_posts WHERE slug = ?', [postSlug],
        (err, row) => resolve(row));
    });
    
    if (existingPost) {
      return res.redirect('/admin/blog/new?error=Slug already exists. Please use a different title.');
    }
    
    // Create new post
    await new Promise(resolve => {
      db.run(`INSERT INTO blog_posts (title, slug, excerpt, content, author, status, featured_image) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, postSlug, excerpt, content, author || 'Admin', status || 'published', featured_image],
        resolve);
    });
    
    res.redirect('/admin/blog?success=Post created successfully!');
  } catch (error) {
    console.error('Error creating blog post:', error);
    res.redirect('/admin/blog/new?error=Error creating post: ' + error.message);
  }
});

app.get('/admin/blog/edit/:id', requireAuth, async (req, res) => {
  try {
    const post = await new Promise(resolve => {
      db.get('SELECT * FROM blog_posts WHERE id = ?', [req.params.id],
        (err, row) => resolve(row));
    });
    
    if (!post) {
      return res.redirect('/admin/blog?error=Post not found');
    }
    
    res.render('admin/blog-edit', {
      title: 'Edit Blog Post - Admin',
      active: 'blog',
      post,
      layout: 'admin/layout-sidebar'
    });
  } catch (error) {
    console.error('Error loading edit blog page:', error);
    res.redirect('/admin/blog?error=Cannot load edit form');
  }
});

app.post('/admin/blog/update/:id', requireAuth, async (req, res) => {
  try {
    const { title, slug, author, excerpt, content, featured_image, status } = req.body;
    const postId = req.params.id;
    
    // Generate slug from title if empty
    let postSlug = slug;
    if (!postSlug || postSlug.trim() === '') {
      postSlug = title.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/--+/g, '-')
        .trim();
    }
    
    // Update post
    await new Promise(resolve => {
      db.run(`UPDATE blog_posts SET title = ?, slug = ?, excerpt = ?, content = ?, author = ?, status = ?, featured_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [title, postSlug, excerpt, content, author || 'Admin', status || 'published', featured_image, postId],
        resolve);
    });
    
    res.redirect('/admin/blog?success=Post updated successfully!');
  } catch (error) {
    console.error('Error updating blog post:', error);
    res.redirect(`/admin/blog/edit/${req.params.id}?error=Error updating post`);
  }
});

app.post('/admin/blog/delete/:id', requireAuth, async (req, res) => {
  try {
    await new Promise(resolve => {
      db.run('DELETE FROM blog_posts WHERE id = ?', [req.params.id], resolve);
    });
    
    res.redirect('/admin/blog?success=Post deleted successfully!');
  } catch (error) {
    console.error('Error deleting blog post:', error);
    res.redirect('/admin/blog?error=Error deleting post');
  }
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🔐 Admin: http://localhost:${PORT}/admin/login`);
  console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
});