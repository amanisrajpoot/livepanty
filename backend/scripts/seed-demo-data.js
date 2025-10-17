const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedDemoData() {
  try {
    console.log('🌱 Seeding demo data...');

    // Create demo performers
    const performers = [
      {
        email: 'emma.rose@demo.com',
        password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J.8QjK.2O', // password: demo123
        display_name: 'Emma Rose',
        username: 'emma_rose',
        role: 'performer',
        date_of_birth: '1995-06-15',
        country: 'US',
        email_verified: true,
        status: 'active',
        bio: 'Welcome to my room! I love chatting and dancing. Join me for some fun! 💕',
        profile_image_url: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
        total_earnings: 1250.50
      },
      {
        email: 'luna.moon@demo.com',
        password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J.8QjK.2O',
        display_name: 'Luna Moon',
        username: 'luna_moon',
        role: 'performer',
        date_of_birth: '1993-03-22',
        country: 'CA',
        email_verified: true,
        status: 'active',
        bio: 'Dancing queen! I love music and movement. Let\'s dance together! 🎵',
        profile_image_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
        total_earnings: 980.25
      },
      {
        email: 'sophia.secret@demo.com',
        password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J.8QjK.2O',
        display_name: 'Sophia Secret',
        username: 'sophia_secret',
        role: 'performer',
        date_of_birth: '1994-11-08',
        country: 'GB',
        email_verified: true,
        status: 'active',
        bio: 'Private sessions available. Let\'s have some intimate fun together 🔒',
        profile_image_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
        total_earnings: 2100.75
      },
      {
        email: 'gamer.girl@demo.com',
        password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J.8QjK.2O',
        display_name: 'Gamer Girl 99',
        username: 'gamer_girl_99',
        role: 'performer',
        date_of_birth: '1996-09-12',
        country: 'US',
        email_verified: true,
        status: 'active',
        bio: 'Gaming enthusiast! Let\'s play together and chat about games 🎮',
        profile_image_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
        total_earnings: 750.00
      },
      {
        email: 'fit.angel@demo.com',
        password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J.8QjK.2O',
        display_name: 'Fit Angel',
        username: 'fit_angel',
        role: 'performer',
        date_of_birth: '1992-04-18',
        country: 'AU',
        email_verified: true,
        status: 'active',
        bio: 'Fitness and wellness coach! Let\'s work out together and stay healthy 💪',
        profile_image_url: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=150&h=150&fit=crop&crop=face',
        total_earnings: 1100.30
      },
      {
        email: 'creative.soul@demo.com',
        password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J.8QjK.2O',
        display_name: 'Creative Soul',
        username: 'creative_soul',
        role: 'performer',
        date_of_birth: '1991-12-03',
        country: 'DE',
        email_verified: true,
        status: 'active',
        bio: 'Artist and creative soul! Let\'s create beautiful art together 🎨',
        profile_image_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face',
        total_earnings: 890.45
      }
    ];

    // Insert performers
    for (const performer of performers) {
      const userResult = await pool.query(`
        INSERT INTO users (email, password_hash, display_name, username, role, date_of_birth, country, email_verified, status, bio, profile_image_url, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          username = EXCLUDED.username,
          bio = EXCLUDED.bio,
          profile_image_url = EXCLUDED.profile_image_url,
          updated_at = NOW()
        RETURNING id
      `, [
        performer.email, performer.password, performer.display_name, performer.username,
        performer.role, performer.date_of_birth, performer.country, performer.email_verified,
        performer.status, performer.bio, performer.profile_image_url
      ]);

      const userId = userResult.rows[0].id;

      // Create wallet for performer
      await pool.query(`
        INSERT INTO wallets (user_id, token_balance, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (user_id, currency_code) DO UPDATE SET updated_at = NOW()
      `, [userId, Math.floor(performer.total_earnings * 100)]); // Convert to tokens

      console.log(`✅ Created performer: ${performer.display_name}`);
    }

    // Get performer IDs for streams
    const performerEmails = [
      'emma.rose@demo.com',
      'luna.moon@demo.com', 
      'sophia.secret@demo.com',
      'gamer.girl@demo.com',
      'fit.angel@demo.com',
      'creative.soul@demo.com'
    ];
    
    const performerIds = {};
    for (const email of performerEmails) {
      const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (result.rows.length > 0) {
        performerIds[email] = result.rows[0].id;
      }
    }

    // Create demo streams
    const streams = [
      {
        host_id: performerIds['emma.rose@demo.com'],
        title: 'Welcome to my room! 💕',
        description: 'Come chat with me! I love meeting new people and having fun conversations.',
        category: 'cam',
        tags: ['new', 'friendly', 'chat'],
        is_live: true
      },
      {
        host_id: performerIds['luna.moon@demo.com'],
        title: 'Dancing & Music 🎵',
        description: 'Let\'s dance together! I\'ll play your favorite songs and we can move together.',
        category: 'dance',
        tags: ['dance', 'music', 'fun'],
        is_live: true
      },
      {
        host_id: performerIds['sophia.secret@demo.com'],
        title: 'Private Session 🔒',
        description: 'Exclusive private session. Let\'s have some intimate fun together.',
        category: 'private',
        tags: ['private', 'exclusive'],
        is_live: true
      },
      {
        host_id: performerIds['gamer.girl@demo.com'],
        title: 'Gaming & Chat 🎮',
        description: 'Let\'s play some games together! I\'m streaming my favorite games and we can chat about gaming.',
        category: 'gaming',
        tags: ['gaming', 'chat', 'fun'],
        is_live: true
      },
      {
        host_id: performerIds['fit.angel@demo.com'],
        title: 'Fitness & Wellness 💪',
        description: 'Join me for a workout session! Let\'s stay healthy and motivated together.',
        category: 'fitness',
        tags: ['fitness', 'wellness', 'motivation'],
        is_live: true
      },
      {
        host_id: performerIds['creative.soul@demo.com'],
        title: 'Art & Creativity 🎨',
        description: 'Let\'s create beautiful art together! I\'ll show you my creative process and we can make art together.',
        category: 'art',
        tags: ['art', 'creative', 'drawing'],
        is_live: true
      }
    ];

    // Insert streams
    for (const stream of streams) {
      await pool.query(`
        INSERT INTO streams (host_id, title, description, category, tags, status, sfu_room_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      `, [
        stream.host_id, stream.title, stream.description, stream.category,
        stream.tags, stream.is_live ? 'live' : 'created', `room_${stream.host_id}_${Date.now()}`
      ]);

      console.log(`✅ Created stream: ${stream.title}`);
    }

    // Create some demo viewers
    const viewers = [
      {
        email: 'viewer1@demo.com',
        password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J.8QjK.2O',
        display_name: 'Demo Viewer 1',
        username: 'demo_viewer_1',
        role: 'viewer',
        date_of_birth: '1990-01-01',
        country: 'US'
      },
      {
        email: 'viewer2@demo.com',
        password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J.8QjK.2O',
        display_name: 'Demo Viewer 2',
        username: 'demo_viewer_2',
        role: 'viewer',
        date_of_birth: '1988-05-15',
        country: 'CA'
      }
    ];

    for (const viewer of viewers) {
      const userResult = await pool.query(`
        INSERT INTO users (email, password_hash, display_name, username, role, date_of_birth, country, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
        RETURNING id
      `, [
        viewer.email, viewer.password, viewer.display_name, viewer.username,
        viewer.role, viewer.date_of_birth, viewer.country
      ]);

      const userId = userResult.rows[0].id;

      // Create wallet for viewer
      await pool.query(`
        INSERT INTO wallets (user_id, token_balance, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (user_id, currency_code) DO UPDATE SET updated_at = NOW()
      `, [userId, 10000]); // Give demo viewers some tokens

      console.log(`✅ Created viewer: ${viewer.display_name}`);
    }

    console.log('🎉 Demo data seeded successfully!');
    console.log('\n📊 Demo Accounts:');
    console.log('Performers:');
    performers.forEach(p => console.log(`  - ${p.display_name} (${p.email}) - password: demo123`));
    console.log('\nViewers:');
    viewers.forEach(v => console.log(`  - ${v.display_name} (${v.email}) - password: demo123`));
    console.log('\n🔗 You can now test the platform with these demo accounts!');

  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
  } finally {
    await pool.end();
  }
}

seedDemoData();
