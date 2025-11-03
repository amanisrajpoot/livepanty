const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedComprehensiveData() {
  try {
    console.log('🌱 Seeding comprehensive demo data...\n');

    // ========================================================================
    // 1. CREATE PERFORMERS
    // ========================================================================
    console.log('📝 Creating performers...');
    const performers = [
      {
        email: 'emma.rose@demo.com',
        password: 'demo123',
        display_name: 'Emma Rose',
        username: 'emma_rose',
        role: 'performer',
        date_of_birth: '1995-06-15',
        country: 'US',
        bio: 'Welcome to my room! I love chatting and dancing. Join me for some fun! 💕',
        profile_image_url: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
      },
      {
        email: 'luna.moon@demo.com',
        password: 'demo123',
        display_name: 'Luna Moon',
        username: 'luna_moon',
        role: 'performer',
        date_of_birth: '1993-03-22',
        country: 'CA',
        bio: 'Dancing queen! I love music and movement. Let\'s dance together! 🎵',
        profile_image_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      },
      {
        email: 'sophia.secret@demo.com',
        password: 'demo123',
        display_name: 'Sophia Secret',
        username: 'sophia_secret',
        role: 'performer',
        date_of_birth: '1994-11-08',
        country: 'GB',
        bio: 'Private sessions available. Let\'s have some intimate fun together 🔒',
        profile_image_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
      },
      {
        email: 'gamer.girl@demo.com',
        password: 'demo123',
        display_name: 'Gamer Girl 99',
        username: 'gamer_girl_99',
        role: 'performer',
        date_of_birth: '1996-09-12',
        country: 'US',
        bio: 'Gaming enthusiast! Let\'s play together and chat about games 🎮',
        profile_image_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
      },
      {
        email: 'fit.angel@demo.com',
        password: 'demo123',
        display_name: 'Fit Angel',
        username: 'fit_angel',
        role: 'performer',
        date_of_birth: '1992-04-18',
        country: 'AU',
        bio: 'Fitness and wellness coach! Let\'s work out together and stay healthy 💪',
        profile_image_url: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=150&h=150&fit=crop&crop=face',
      },
      {
        email: 'creative.soul@demo.com',
        password: 'demo123',
        display_name: 'Creative Soul',
        username: 'creative_soul',
        role: 'performer',
        date_of_birth: '1991-12-03',
        country: 'DE',
        bio: 'Artist and creative soul! Let\'s create beautiful art together 🎨',
        profile_image_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face',
      }
    ];

    const performerIds = {};
    for (const performer of performers) {
      const passwordHash = await bcrypt.hash(performer.password, 12);
      
      const userResult = await pool.query(`
        INSERT INTO users (email, password_hash, display_name, username, role, date_of_birth, country, email_verified, status, bio, profile_image_url, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, 'active', $8, $9, NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days', NOW())
        ON CONFLICT (email) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          username = EXCLUDED.username,
          bio = EXCLUDED.bio,
          profile_image_url = EXCLUDED.profile_image_url,
          updated_at = NOW()
        RETURNING id
      `, [
        performer.email, passwordHash, performer.display_name, performer.username,
        performer.role, performer.date_of_birth, performer.country,
        performer.bio, performer.profile_image_url
      ]);

      const userId = userResult.rows[0].id;
      performerIds[performer.email] = userId;

      // Create wallet for performer with some earnings
      const existingWallet = await pool.query('SELECT id FROM wallets WHERE user_id = $1 AND currency_code = $2', [userId, 'USD']);
      if (existingWallet.rows.length === 0) {
        await pool.query(`
          INSERT INTO wallets (user_id, token_balance, currency_code, created_at, updated_at)
          VALUES ($1, $2, 'USD', NOW(), NOW())
        `, [userId, Math.floor(Math.random() * 2000 + 500)]); // 500-2500 tokens
      } else {
        await pool.query(`
          UPDATE wallets SET token_balance = $1, updated_at = NOW() WHERE user_id = $2 AND currency_code = 'USD'
        `, [Math.floor(Math.random() * 2000 + 500), userId]);
      }

      // Create user preferences
      const existingPrefs = await pool.query('SELECT id FROM user_preferences WHERE user_id = $1', [userId]);
      if (existingPrefs.rows.length === 0) {
        await pool.query(`
          INSERT INTO user_preferences (user_id, created_at, updated_at)
          VALUES ($1, NOW(), NOW())
        `, [userId]);
      }

      console.log(`✅ Created performer: ${performer.display_name} (${userId})`);
    }

    // ========================================================================
    // 2. CREATE VIEWERS
    // ========================================================================
    console.log('\n👥 Creating viewers...');
    const viewers = [
      { email: 'viewer1@demo.com', display_name: 'Demo Viewer 1', username: 'demo_viewer_1', country: 'US' },
      { email: 'viewer2@demo.com', display_name: 'Demo Viewer 2', username: 'demo_viewer_2', country: 'CA' },
      { email: 'viewer3@demo.com', display_name: 'TipMaster', username: 'tip_master', country: 'US' },
      { email: 'viewer4@demo.com', display_name: 'FanGirl', username: 'fan_girl', country: 'GB' },
      { email: 'viewer5@demo.com', display_name: 'RegularUser', username: 'regular_user', country: 'AU' },
    ];

    const viewerIds = {};
    const passwordHash = await bcrypt.hash('demo123', 12);

    for (const viewer of viewers) {
      const userResult = await pool.query(`
        INSERT INTO users (email, password_hash, display_name, username, role, date_of_birth, country, email_verified, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'viewer', '1990-01-01', $5, true, 'active', NOW() - INTERVAL '${Math.floor(Math.random() * 60)} days', NOW())
        ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
        RETURNING id
      `, [viewer.email, passwordHash, viewer.display_name, viewer.username, viewer.country]);

      const userId = userResult.rows[0].id;
      viewerIds[viewer.email] = userId;

      // Create wallet with tokens for tipping
      const tokenBalance = viewer.email.includes('TipMaster') ? 50000 : Math.floor(Math.random() * 10000 + 1000);
      const existingViewerWallet = await pool.query('SELECT id FROM wallets WHERE user_id = $1 AND currency_code = $2', [userId, 'USD']);
      if (existingViewerWallet.rows.length === 0) {
        await pool.query(`
          INSERT INTO wallets (user_id, token_balance, currency_code, created_at, updated_at)
          VALUES ($1, $2, 'USD', NOW(), NOW())
        `, [userId, tokenBalance]);
      } else {
        await pool.query(`
          UPDATE wallets SET token_balance = $1, updated_at = NOW() WHERE user_id = $2 AND currency_code = 'USD'
        `, [tokenBalance, userId]);
      }

      // Create user preferences
      const existingPrefs = await pool.query('SELECT id FROM user_preferences WHERE user_id = $1', [userId]);
      if (existingPrefs.rows.length === 0) {
        await pool.query(`
          INSERT INTO user_preferences (user_id, created_at, updated_at)
          VALUES ($1, NOW(), NOW())
        `, [userId]);
      }

      console.log(`✅ Created viewer: ${viewer.display_name} (${userId})`);
    }

    // ========================================================================
    // 3. CREATE STREAMS
    // ========================================================================
    console.log('\n📺 Creating streams...');
    const streamData = [
      {
        host_email: 'emma.rose@demo.com',
        title: 'Welcome to my room! 💕',
        description: 'Come chat with me! I love meeting new people and having fun conversations.',
        category: 'cam',
        tags: ['new', 'friendly', 'chat'],
        status: 'live',
        viewer_count: 1247,
        peak_viewer_count: 1500,
        total_tokens_received: 12500,
        is_private: false,
        started_at: new Date(Date.now() - 2 * 60 * 60 * 1000) // Started 2 hours ago
      },
      {
        host_email: 'luna.moon@demo.com',
        title: 'Dancing & Music 🎵',
        description: 'Let\'s dance together! I\'ll play your favorite songs and we can move together.',
        category: 'dance',
        tags: ['dance', 'music', 'fun'],
        status: 'live',
        viewer_count: 892,
        peak_viewer_count: 1100,
        total_tokens_received: 9800,
        is_private: false,
        started_at: new Date(Date.now() - 4 * 60 * 60 * 1000) // Started 4 hours ago
      },
      {
        host_email: 'sophia.secret@demo.com',
        title: 'Private Session 🔒',
        description: 'Exclusive private session. Let\'s have some intimate fun together.',
        category: 'private',
        tags: ['private', 'exclusive'],
        status: 'live',
        viewer_count: 156,
        peak_viewer_count: 200,
        total_tokens_received: 21000,
        is_private: true,
        started_at: new Date(Date.now() - 1 * 60 * 60 * 1000) // Started 1 hour ago
      },
      {
        host_email: 'gamer.girl@demo.com',
        title: 'Gaming & Chat 🎮',
        description: 'Let\'s play some games together! I\'m streaming my favorite games and we can chat about gaming.',
        category: 'gaming',
        tags: ['gaming', 'chat', 'fun'],
        status: 'live',
        viewer_count: 634,
        peak_viewer_count: 850,
        total_tokens_received: 7500,
        is_private: false,
        started_at: new Date(Date.now() - 3 * 60 * 60 * 1000) // Started 3 hours ago
      },
      {
        host_email: 'fit.angel@demo.com',
        title: 'Fitness & Wellness 💪',
        description: 'Join me for a workout session! Let\'s stay healthy and motivated together.',
        category: 'fitness',
        tags: ['fitness', 'wellness', 'motivation'],
        status: 'live',
        viewer_count: 423,
        peak_viewer_count: 500,
        total_tokens_received: 4200,
        is_private: false,
        started_at: new Date(Date.now() - 5 * 60 * 60 * 1000) // Started 5 hours ago
      },
      {
        host_email: 'creative.soul@demo.com',
        title: 'Art & Creativity 🎨',
        description: 'Let\'s create beautiful art together! I\'ll show you my creative process and we can make art together.',
        category: 'art',
        tags: ['art', 'creative', 'drawing'],
        status: 'live',
        viewer_count: 287,
        peak_viewer_count: 350,
        total_tokens_received: 3200,
        is_private: false,
        started_at: new Date(Date.now() - 1.5 * 60 * 60 * 1000) // Started 1.5 hours ago
      },
      {
        host_email: 'emma.rose@demo.com',
        title: 'Late Night Chat 🌙',
        description: 'Late night vibes! Let\'s chat and have a good time.',
        category: 'cam',
        tags: ['chat', 'night', 'relaxed'],
        status: 'ended',
        viewer_count: 0,
        peak_viewer_count: 800,
        total_tokens_received: 6500,
        is_private: false,
        started_at: new Date(Date.now() - 24 * 60 * 60 * 1000), // Started 24 hours ago
        ended_at: new Date(Date.now() - 22 * 60 * 60 * 1000) // Ended 22 hours ago
      }
    ];

    const streamIds = {};
    for (const stream of streamData) {
      const hostId = performerIds[stream.host_email];
      if (!hostId) continue;

      const sfuRoomId = `room_${Date.now()}_${hostId}_${Math.random().toString(36).substr(2, 9)}`;
      
      const streamResult = await pool.query(`
        INSERT INTO streams (
          host_id, title, description, category, tags, status, sfu_room_id,
          viewer_count, peak_viewer_count, total_tokens_received,
          is_private, started_at, ended_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
        RETURNING id
      `, [
        hostId, stream.title, stream.description, stream.category,
        stream.tags, stream.status, sfuRoomId,
        stream.viewer_count, stream.peak_viewer_count, stream.total_tokens_received,
        stream.is_private, stream.started_at, stream.ended_at || null
      ]);

      const streamId = streamResult.rows[0].id;
      streamIds[stream.title] = { id: streamId, host_id: hostId };
      console.log(`✅ Created stream: ${stream.title} (${streamId}) - Status: ${stream.status}`);
    }

    // ========================================================================
    // 4. CREATE TIPS & TRANSACTIONS
    // ========================================================================
    console.log('\n💰 Creating tips and transactions...');
    
    // Get live stream IDs
    const liveStreams = Object.values(streamIds).filter(s => s.id);
    const allViewerIds = Object.values(viewerIds);
    const allPerformerIds = Object.values(performerIds);

    if (liveStreams.length > 0 && allViewerIds.length > 0) {
      // Create tips for each live stream
      for (let i = 0; i < Math.min(20, liveStreams.length * 3); i++) {
        const stream = liveStreams[Math.floor(Math.random() * liveStreams.length)];
        const viewerId = allViewerIds[Math.floor(Math.random() * allViewerIds.length)];
        const performerId = stream.host_id;
        
        if (viewerId === performerId) continue; // Skip self-tips

        const tipAmount = [10, 25, 50, 100, 200, 500][Math.floor(Math.random() * 6)];
        const tipMessages = [
          'Amazing stream!',
          'Love your energy!',
          'Keep it up!',
          'You\'re awesome!',
          'Great content!',
          'Thanks for streaming!',
          'Best performer ever!'
        ];

        try {
          // Create tip
          const tipResult = await pool.query(`
            INSERT INTO tips (stream_id, from_user_id, to_user_id, tokens, message, is_private, created_at)
            VALUES ($1, $2, $3, $4, $5, false, NOW() - INTERVAL '${Math.floor(Math.random() * 120)} minutes')
            RETURNING id
          `, [
            stream.id, viewerId, performerId, tipAmount,
            tipMessages[Math.floor(Math.random() * tipMessages.length)]
          ]);

          // Create ledger entry for tip (debit from viewer)
          await pool.query(`
            INSERT INTO ledger (user_id, counterparty_id, transaction_type, amount_tokens, description, created_at)
            VALUES ($1, $2, 'tip_sent', $3 * -1, $4, NOW() - INTERVAL '${Math.floor(Math.random() * 120)} minutes')
          `, [
            viewerId, performerId, tipAmount, `Tip to performer`
          ]);

          // Create ledger entry for tip (credit to performer)
          await pool.query(`
            INSERT INTO ledger (user_id, counterparty_id, transaction_type, amount_tokens, description, created_at)
            VALUES ($1, $2, 'tip_received', $3, $4, NOW() - INTERVAL '${Math.floor(Math.random() * 120)} minutes')
          `, [
            performerId, viewerId, tipAmount, `Tip from viewer`
          ]);

          // Update wallet balances
          await pool.query(`
            UPDATE wallets 
            SET token_balance = token_balance - $1
            WHERE user_id = $2
          `, [tipAmount, viewerId]);

          await pool.query(`
            UPDATE wallets 
            SET token_balance = token_balance + $1
            WHERE user_id = $2
          `, [tipAmount, performerId]);

          // Update stream total tokens
          await pool.query(`
            UPDATE streams 
            SET total_tokens_received = total_tokens_received + $1
            WHERE id = $2
          `, [tipAmount, stream.id]);

        } catch (error) {
          // Ignore duplicate errors
          if (!error.message.includes('duplicate')) {
            console.log(`⚠️  Error creating tip: ${error.message}`);
          }
        }
      }

      // Create token purchases for viewers
      const purchaseAmounts = [100, 500, 1000, 2500, 5000];
      for (let i = 0; i < 10; i++) {
        const viewerId = allViewerIds[Math.floor(Math.random() * allViewerIds.length)];
        const amount = purchaseAmounts[Math.floor(Math.random() * purchaseAmounts.length)];

        try {
          await pool.query(`
            INSERT INTO ledger (user_id, transaction_type, amount_tokens, description, created_at)
            VALUES ($1, 'token_purchase', $2, 'Token purchase', NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days')
          `, [viewerId, amount]);

          await pool.query(`
            UPDATE wallets 
            SET token_balance = token_balance + $1
            WHERE user_id = $2
          `, [amount, viewerId]);

        } catch (error) {
          if (!error.message.includes('duplicate')) {
            console.log(`⚠️  Error creating purchase: ${error.message}`);
          }
        }
      }

      console.log(`✅ Created ${Math.min(20, liveStreams.length * 3)} tips and 10 purchases`);
    }

    // ========================================================================
    // 5. CREATE KYC VERIFICATIONS
    // ========================================================================
    console.log('\n🆔 Creating KYC verifications...');
    
    const kycStatuses = ['pending', 'in_review', 'approved', 'rejected'];
    for (let i = 0; i < Math.min(4, allPerformerIds.length); i++) {
      const performerId = allPerformerIds[i];
      const status = kycStatuses[Math.floor(Math.random() * kycStatuses.length)];

      try {
        await pool.query(`
          INSERT INTO kyc_verifications (
            user_id, status, verification_type, submitted_at, 
            reviewed_at, created_at, updated_at
          )
          VALUES (
            $1, $2, 'performer', NOW() - INTERVAL '${Math.floor(Math.random() * 7)} days',
            ${status === 'approved' || status === 'rejected' ? `NOW() - INTERVAL '${Math.floor(Math.random() * 3)} days'` : 'NULL'},
            NOW(), NOW()
          )
          ON CONFLICT (user_id, verification_type) DO NOTHING
        `, [performerId, status]);

        console.log(`✅ Created KYC for performer ${performerId} - Status: ${status}`);
      } catch (error) {
        // Ignore if already exists
      }
    }

    // ========================================================================
    // 6. CREATE SOME PAST STREAMS (for analytics)
    // ========================================================================
    console.log('\n📊 Creating historical streams for analytics...');
    
    const categories = ['cam', 'dance', 'gaming', 'fitness', 'art', 'music'];
    for (let i = 0; i < 30; i++) {
      const hostId = allPerformerIds[Math.floor(Math.random() * allPerformerIds.length)];
      const category = categories[Math.floor(Math.random() * categories.length)];
      const daysAgo = Math.floor(Math.random() * 30) + 1;
      
      const startedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const endedAt = new Date(startedAt.getTime() + (Math.random() * 4 + 1) * 60 * 60 * 1000); // 1-5 hours duration
      
      try {
        await pool.query(`
          INSERT INTO streams (
            host_id, title, description, category, tags, status, sfu_room_id,
            viewer_count, peak_viewer_count, total_tokens_received,
            is_private, started_at, ended_at, created_at, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, 'ended', $6,
            $7, $8, $9, false, $10, $11, $12, NOW()
          )
        `, [
          hostId,
          `${category.charAt(0).toUpperCase() + category.slice(1)} Stream ${i + 1}`,
          `Past ${category} stream`,
          category,
          [category, 'stream', 'past'],
          `room_past_${hostId}_${Date.now()}_${i}`,
          Math.floor(Math.random() * 500 + 50),
          Math.floor(Math.random() * 800 + 100),
          Math.floor(Math.random() * 5000 + 500),
          startedAt,
          endedAt,
          startedAt
        ]);
      } catch (error) {
        // Ignore errors
      }
    }

    console.log(`✅ Created 30 historical streams`);

    // ========================================================================
    // 7. CREATE ADMIN USER (if not exists)
    // ========================================================================
    console.log('\n👑 Creating admin user...');
    
    const adminPasswordHash = await bcrypt.hash('admin123', 12);
    const existingAdmin = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@livepanty.com']);
    let adminId;
    
    if (existingAdmin.rows.length === 0) {
      const adminResult = await pool.query(`
        INSERT INTO users (
          email, password_hash, display_name, username, role, date_of_birth, country,
          email_verified, status, created_at, updated_at
        )
        VALUES (
          'admin@livepanty.com', $1, 'Admin User', 'admin', 'admin', '1990-01-01', 'US',
          true, 'active', NOW(), NOW()
        )
        RETURNING id
      `, [adminPasswordHash]);
      adminId = adminResult.rows[0].id;
    } else {
      adminId = existingAdmin.rows[0].id;
      // Update password if needed
      await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [adminPasswordHash, adminId]);
    }

    const existingAdminWallet = await pool.query('SELECT id FROM wallets WHERE user_id = $1 AND currency_code = $2', [adminId, 'USD']);
    if (existingAdminWallet.rows.length === 0) {
      await pool.query(`
        INSERT INTO wallets (user_id, token_balance, currency_code, created_at, updated_at)
        VALUES ($1, 0, 'USD', NOW(), NOW())
      `, [adminId]);
    }

    const existingAdminPrefs = await pool.query('SELECT id FROM user_preferences WHERE user_id = $1', [adminId]);
    if (existingAdminPrefs.rows.length === 0) {
      await pool.query(`
        INSERT INTO user_preferences (user_id, created_at, updated_at)
        VALUES ($1, NOW(), NOW())
      `, [adminId]);
    }

    console.log(`✅ Admin user created: admin@livepanty.com (password: admin123)`);

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('\n' + '='.repeat(60));
    console.log('🎉 COMPREHENSIVE DATA SEEDING COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n📊 DEMO ACCOUNTS:');
    console.log('\n👑 Admin:');
    console.log('   Email: admin@livepanty.com');
    console.log('   Password: admin123');
    console.log('   Role: admin');
    
    console.log('\n🎭 Performers:');
    performers.forEach(p => {
      console.log(`   ${p.display_name}`);
      console.log(`   Email: ${p.email} | Password: ${p.password}`);
      console.log(`   ID: ${performerIds[p.email]}`);
    });
    
    console.log('\n👥 Viewers:');
    viewers.forEach(v => {
      console.log(`   ${v.display_name}`);
      console.log(`   Email: ${v.email} | Password: demo123`);
      console.log(`   ID: ${viewerIds[v.email]}`);
    });

    console.log('\n📺 STREAMS:');
    console.log(`   Total streams created: ${Object.keys(streamIds).length}`);
    console.log(`   Live streams: ${streamData.filter(s => s.status === 'live').length}`);
    console.log(`   Historical streams: 30`);
    
    console.log('\n💰 FINANCIAL:');
    console.log('   Tips created: ~20');
    console.log('   Token purchases: 10');
    
    console.log('\n🔗 QUICK ACCESS:');
    console.log('   View streams: http://localhost:3000/streams');
    console.log('   Admin dashboard: http://localhost:3000/admin');
    console.log('   Login: http://localhost:3000/login');
    
    console.log('\n✨ You can now test all functionalities!');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run seed
seedComprehensiveData();

