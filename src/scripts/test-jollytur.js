const { JollyTurScraper } = require('./dist/services/scraping/JollyTurScraper.js');

async function testJollyTurScraper() {
  const scraper = new JollyTurScraper();
  
  try {
    console.log('🚀 Starting JollyTur scraper test...');
    
    // Initialize scraper (non-headless for debugging)
    await scraper.initialize(false);
    
    // Test search parameters
    const searchParams = {
      checkInDate: '2025-10-26',
      checkOutDate: '2025-10-30',
      adults: 2,
      children: 0
    };
    
    console.log('🔍 Testing hotel scraping...');
    
    // Test scraping the Crystal Prestige Elite hotel
    const hotelSlug = 'crystal-prestige-elite';
    
    console.log(`🏨 Testing scraping for hotel: ${hotelSlug}`);
    
    const scrapedData = await scraper.scrapeHotelDetails(hotelSlug, searchParams);
    
    if (scrapedData) {
      console.log('✅ Hotel scraping successful!');
      console.log('🏨 Hotel name:', scrapedData.hotelName);
      console.log(`🏨 Found ${scrapedData.rooms?.length || 0} rooms:`);
      
      if (scrapedData.rooms && scrapedData.rooms.length > 0) {
        scrapedData.rooms.forEach((room, index) => {
          console.log(`\n📋 Room ${index + 1}:`);
          console.log(`   Name: ${room.roomName}`);
          console.log(`   Type: ${room.roomType}`);
          console.log(`   Concept: ${room.concept}`);
          console.log(`   Size: ${room.roomSize}`);
          console.log(`   Bed Type: ${room.bedType}`);
          console.log(`   View: ${room.view}`);
          console.log(`   Smoking Policy: ${room.smokingPolicy}`);
          console.log(`   Min Stay: ${room.minStay}`);
          console.log(`   Available: ${room.isAvailable ? 'Yes' : 'No'}`);
          
          // Pricing information
          console.log(`   💰 Pricing:`);
          console.log(`      Old Price: ${room.totalPrice.oldPrice}`);
          console.log(`      Current Price: ${room.totalPrice.currentPrice} ${room.totalPrice.currency}`);
          console.log(`      Discount: ${room.totalPrice.discountPercent}`);
          
          // Daily prices
          if (room.dailyPrices && room.dailyPrices.length > 0) {
            console.log(`   📅 Daily Prices:`);
            room.dailyPrices.forEach(dailyPrice => {
              console.log(`      ${dailyPrice.day} (${dailyPrice.date} - ${dailyPrice.dayOfWeek}): ${dailyPrice.currentPrice} (was ${dailyPrice.oldPrice})`);
            });
          }
          
          // Amenities
          if (room.amenities && room.amenities.length > 0) {
            console.log(`   🛏️ Amenities (${room.amenities.length}):`);
            room.amenities.forEach(amenity => {
              console.log(`      ${amenity.name}${amenity.isPaid ? ' (Paid)' : ''}`);
            });
          }
          
          // Badges
          if (room.badges && room.badges.length > 0) {
            console.log(`   🏷️ Badges (${room.badges.length}):`);
            room.badges.forEach(badge => {
              console.log(`      ${badge.text}`);
            });
          }
          
          // Campaign tags
          if (room.campaignTags && room.campaignTags.length > 0) {
            console.log(`   🎯 Campaign Tags (${room.campaignTags.length}):`);
            room.campaignTags.forEach(tag => {
              console.log(`      ${tag}`);
            });
          }
          
          // Images
          if (room.images && room.images.length > 0) {
            console.log(`   📸 Images (${room.images.length}):`);
            room.images.slice(0, 3).forEach((image, imgIndex) => {
              console.log(`      ${imgIndex + 1}. ${image.thumbnail}`);
            });
            if (room.images.length > 3) {
              console.log(`      ... and ${room.images.length - 3} more`);
            }
          }
          
          // Policies
          if (room.cancellationPolicy) {
            console.log(`   📋 Cancellation Policy: ${room.cancellationPolicy}`);
          }
          if (room.childPolicy) {
            console.log(`   👶 Child Policy: ${room.childPolicy}`);
          }
          
          // Description
          if (room.description) {
            console.log(`   📝 Description: ${room.description.substring(0, 100)}...`);
          }
        });
      }
      
      // Save the scraped data
      console.log('💾 Saving scraped data...');
      const savedFilePath = await scraper.saveScrapedData(scrapedData);
      console.log('✅ Data saved successfully!');
      console.log(`📁 File saved to: ${savedFilePath}`);
      
    } else {
      console.log('❌ Hotel scraping failed: No data returned');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Close the scraper
    await scraper.close();
    console.log('✅ Test completed');
  }
}

// Run the test
testJollyTurScraper(); 