const { TatilsepetiScraper } = require('./dist/services/scraping/TatilsepetiScraper.js');

async function testNormalScraping() {
  console.log('🚀 Testing NORMAL Tatilsepeti scraping (no modals)...');

  const scraper = new TatilsepetiScraper();

  try {
    // Initialize scraper
    await scraper.initialize(false); // false = visible browser for debugging

    // Test parameters
    const searchParams = {
      hotelName: 'adalya-ocean-deluxe',
      checkInDate: '31.07.2025',
      checkOutDate: '20.08.2025',
      adults: 2,
      children: 0
    };

    // Test search flow
    console.log('🔍 Testing search flow...');
    await scraper.searchHotels(searchParams);

    // Test NORMAL scraping only (no modals)
    console.log('📋 Testing NORMAL scraping (basic room data only)...');
    const scrapedData = await scraper.scrapeHotelDetails();

    if (scrapedData.success) {
      console.log('✅ Normal scraping successful!');
      console.log(`🏨 Hotel name: ${scrapedData.hotelName}`);
      console.log(`🏨 Found ${scrapedData.rooms?.length || 0} rooms:\n`);

      // Display basic room data
      scrapedData.rooms?.forEach((room, index) => {
        console.log(`📋 Room ${index + 1}:`);
        console.log(`   Name: ${room.name}`);
        console.log(`   Size: ${room.size}`);
        console.log(`   Concept: ${room.concept}`);
        console.log(`   Total Price: ${room.totalPrice}`);
        console.log(`   Discounted Price: ${room.discountedPrice}`);
        console.log(`   Discount: ${room.discount}`);
        console.log(`   Capacity: ${room.capacity}`);
        console.log(`   Available: ${room.available}`);
        console.log(`   Features: ${room.features?.join(', ')}`);
        console.log('');
      });

      // Save the data
      console.log('💾 Saving scraped data...');
      const filepath = await scraper.saveScrapedData(scrapedData, searchParams);
      console.log('✅ Data saved successfully!');
      console.log(`📁 File saved to: ${filepath}`);

    } else {
      console.error('❌ Normal scraping failed:', scrapedData.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await scraper.close();
    console.log('✅ Test completed');
  }
}

testNormalScraping(); 