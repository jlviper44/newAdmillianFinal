# Campaigns Module - Requirements & Todo List

## 🎯 Core Campaign Features
- [ ] Generated page should be default Shopify page (blank)
- [ ] Redirect option should be checked by default
- [ ] Inject redirect script accordingly for:
  - iOS
  - Android  
  - Desktop

## 🔗 Affiliate Links
- [ ] Re-introduce affiliate links functionality
- [ ] Use link splitter for smart links to route offers properly
- [ ] Submitted links go into campaign

## 🛍️ Shopify Integration
- [ ] Re-introduce second Shopify page to host landing pages
- [ ] Option: generate landing pages on Shopify 2 like before
- [ ] Support custom redirect link OR Shopify 2 template

## 📊 Tracking Parameters
- [ ] Add support for default Shopify blank pages with custom sub-parameters
- [ ] Example URL structure:
  ```
  https://www.phef6trk.com/GX85BS/2GT2L5F/?source_id=asdga&sub1=dsa&sub2=aasgd&sub3=aasdgas
  ```
  
### Parameter Mapping:
- **source_id**: meta, google, tiktok, snap, native, organic
- **sub1**: campaign ID
- **sub2**: VA identifier
- **sub3**: other data