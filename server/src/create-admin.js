require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
(async () => {
  try {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD;
    if (!password || password.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters');
    await mongoose.connect(process.env.MONGODB_URI, {maxPoolSize: 2});
    const existing = await User.findOne({username});
    if (existing) {
      if (existing.role !== 'admin') throw new Error('Username belongs to a non-admin account');
      console.log('Admin already exists; password unchanged.');
      return;
    }
    await User.create({username, password:await bcrypt.hash(password,10), role:'admin', status:'active'});
    console.log('Admin created. No demo data inserted.');
  } catch (e) { console.error(e.message); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
})();
