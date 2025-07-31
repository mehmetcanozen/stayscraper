const { TouristicaScraper } = require('./dist/services/scraping/TouristicaScraper');

async function testTouristicaScraper() {
  const scraper = new TouristicaScraper();
  
  try {
    console.log('🚀 Starting Touristica scraper test...');
    
    // Initialize the scraper
    await scraper.initialize(false); // false = not headless for debugging
    
    // Test parameters
    const searchParams = {
      checkInDate: '2025-08-21',
      checkOutDate: '2025-08-28',
      adults: 2,
      children: 2,
      childAges: [9, 3]
    };
    
    const hotelSlug = 'adora-hotel-resort';
    
    console.log(`🏨 Testing with hotel: ${hotelSlug}`);
    console.log(`📅 Search params:`, searchParams);
    
    // Scrape hotel details
    const scrapedData = await scraper.scrapeHotelDetails(hotelSlug, searchParams);
    
    if (scrapedData) {
      console.log('✅ Hotel scraping successful!');
      console.log(`🏨 Hotel name: ${scrapedData.hotelName}`);
      console.log(`🏠 ODALAR VE FİYATLAR items: ${scrapedData.odalarVeFiyatlar.length}`);
      console.log(`🏠 FİYAT LİSTESİ room types: ${scrapedData.fiyatListesi.length}`);
      
      // Display ODALAR VE FİYATLAR data
      if (scrapedData.odalarVeFiyatlar.length > 0) {
        console.log('\n📋 ODALAR VE FİYATLAR Data:');
        scrapedData.odalarVeFiyatlar.forEach((item, index) => {
          console.log(`   Item ${index + 1}: ${item.roomName}`);
          console.log(`     Availability: ${item.availability}`);
          console.log(`     Price: ${item.price}`);
          if (item.oldPrice) console.log(`     Old Price: ${item.oldPrice}`);
          console.log(`     Board Type: ${item.boardType}`);
          console.log(`     Room Type: ${item.roomType}`);
        });
      }
      
      // Display FİYAT LİSTESİ data
      if (scrapedData.fiyatListesi.length > 0) {
        console.log('\n📋 FİYAT LİSTESİ Data:');
        scrapedData.fiyatListesi.forEach((room, index) => {
          console.log(`\n📋 Room ${index + 1}: ${room.roomName}`);
          console.log(`📅 Price periods: ${room.pricePeriods.length}`);
          console.log(`💰 Pricing info entries: ${room.pricingInfo.length}`);
          
          if (room.pricePeriods.length > 0) {
            console.log(`   Period: ${room.pricePeriods[0].period}`);
            console.log(`   Week days: ${room.pricePeriods[0].weekDays}`);
            console.log(`   Min nights: ${room.pricePeriods[0].minimumNights}`);
          }
          if (room.pricingInfo.length > 0) {
            const pricing = room.pricingInfo[0];
            console.log(`   Discount: ${pricing.discountRate}`);
            console.log(`   Board type: ${pricing.boardType}`);
            console.log(`   Double room price: ${pricing.doubleRoomPrice}`);
            console.log(`   Single room price: ${pricing.singleRoomPrice}`);
          }
        });
      }
      
      // Save the data
      await scraper.saveScrapedData(scrapedData);
      console.log('💾 Data saved successfully!');
      
    } else {
      console.log('❌ Hotel scraping failed: No data returned');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await scraper.close();
    console.log('✅ Test completed');
  }
}

// Run the test
testTouristicaScraper(); 