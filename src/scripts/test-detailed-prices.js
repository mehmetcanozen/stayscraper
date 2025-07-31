const { TatilsepetiScraper } = require('./dist/services/scraping/TatilsepetiScraper.js');

async function testDetailedPrices() {
  console.log('🚀 Testing enhanced detailed price scraping...');
  
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
    
    // Test detailed price scraping only
    console.log('💰 Testing enhanced detailed price scraping...');
    const detailedPrices = await scraper.scrapeDetailedPrices();
    
    console.log(`✅ Found detailed prices for ${detailedPrices.length} rooms`);
    
    // Display the enhanced data
    detailedPrices.forEach((roomData, index) => {
      console.log(`\n📋 Room ${index + 1} (${roomData.modalInfo?.title || 'Unknown'}):`);
      console.log(`   Modal Title: ${roomData.modalInfo?.title || 'N/A'}`);
      console.log(`   Alert Info: ${roomData.modalInfo?.alert || 'N/A'}`);
      console.log(`   Number of price periods: ${roomData.prices?.length || 0}`);
      
      if (roomData.prices && roomData.prices.length > 0) {
        console.log('   Price periods:');
        roomData.prices.forEach((price, pIndex) => {
          console.log(`     Period ${pIndex + 1}: ${price.period}`);
          console.log(`       Type: ${price.type}`);
          console.log(`       Double Price (per person): ${price.doublePrice}`);
          console.log(`       Single Price: ${price.singlePrice}`);
          console.log(`       Extra Bed: ${price.extraBed}`);
          
          if (price.childrenPricing && price.childrenPricing.length > 0) {
            console.log(`       Children Pricing:`);
            price.childrenPricing.forEach(child => {
              console.log(`         ${child.childNumber} - ${child.childAge}: ${child.childPrice}`);
            });
          }
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await scraper.close();
    console.log('✅ Test completed');
  }
}

testDetailedPrices(); 