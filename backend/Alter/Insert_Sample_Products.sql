/* ===================================================================
   Insert 20 Sample Gym Supplement Products for GymCore
   - All products have IsActive = 1 (visible to both Admin & Customer)
   - Products include: Whey Protein, Creatine, Mass Gainer, Pre-Workout, BCAA, Multivitamin
   - Images from Unsplash (high quality)
   =================================================================== */

USE GymCore;
GO

-- Get Admin UserID for UpdatedBy field
DECLARE @AdminID INT = (SELECT UserID FROM dbo.Users WHERE Email = N'admin@gymcore.local');

IF @AdminID IS NULL
BEGIN
    RAISERROR('Admin user not found. Please run InsertValues.txt first to create base users.', 16, 1);
    RETURN;
END;

-- Insert 20 Sample Products
INSERT INTO dbo.Products (ProductName, Description, Price, ImageUrl, IsActive, UpdatedBy)
SELECT v.ProductName, v.Description, v.Price, v.ImageUrl, CAST(1 AS BIT), @AdminID
FROM (VALUES
    -- Whey Protein (4 products)
    (
        N'Whey Protein Isolate - Vanilla',
        N'100% pure whey protein isolate. 25g protein per serving. Perfect for muscle recovery and growth. Low carb, low fat. Imported from USA.',
        CAST(1200000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1579722820308-d74e571900a9?w=500'
    ),
    (
        N'Whey Protein Concentrate - Chocolate',
        N'Premium whey protein concentrate. 24g protein per serving. Rich chocolate flavor. Great for post-workout. Contains BCAAs and essential amino acids.',
        CAST(900000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=500'
    ),
    (
        N'Whey Protein Blend - Strawberry',
        N'Advanced whey protein blend (isolate + concentrate). 23g protein per serving. Delicious strawberry taste. Easy to mix, smooth texture.',
        CAST(950000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1622484211126-f3347e0c2d58?w=500'
    ),
    (
        N'Hydrolyzed Whey Protein - Unflavored',
        N'Fast-absorbing hydrolyzed whey protein. 26g protein per serving. Ideal for quick post-workout recovery. Pre-digested for better absorption.',
        CAST(1350000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=500'
    ),
    
    -- Creatine (4 products)
    (
        N'Creatine Monohydrate - Micronized',
        N'Pure micronized creatine monohydrate. 5g per serving. Supports strength and power output. Clinically proven formula. 100 servings.',
        CAST(350000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=500'
    ),
    (
        N'Creatine HCL - Ultra Pure',
        N'Creatine Hydrochloride. Better absorption, no bloating. 3g per serving. Enhanced solubility and bioavailability. 120 servings.',
        CAST(450000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1534368420702-00fa0cd5a7dc?w=500'
    ),
    (
        N'Creatine Ethyl Ester',
        N'Advanced creatine ethyl ester formula. Enhanced cellular uptake. 4g per serving. Supports ATP production and muscle endurance.',
        CAST(420000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=500'
    ),
    (
        N'Buffered Creatine - Kre-Alkalyn',
        N'pH-buffered creatine for optimal stability. No loading phase required. 3g per serving. Reduced side effects, maximum results.',
        CAST(500000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1556817411-58c45dd94e8c?w=500'
    ),
    
    -- Mass Gainer (4 products)
    (
        N'Mass Gainer - Chocolate Supreme',
        N'High-calorie mass gainer. 1250 calories, 50g protein per serving. Perfect for hard gainers. Contains complex carbs and healthy fats.',
        CAST(950000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=500'
    ),
    (
        N'Lean Mass Gainer - Vanilla',
        N'Clean lean mass formula. 800 calories, 45g protein per serving. Low sugar. Premium ingredients for quality muscle gains.',
        CAST(880000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=500'
    ),
    (
        N'Serious Mass - Banana',
        N'Serious mass building formula. 1300 calories, 52g protein. Enriched with vitamins and minerals. 6 lbs container.',
        CAST(1000000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1579722820308-d74e571900a9?w=500'
    ),
    (
        N'Weight Gainer Pro - Cookies & Cream',
        N'Professional weight gainer. 900 calories, 48g protein per serving. Delicious cookies & cream flavor. Easy to digest.',
        CAST(850000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1622484211126-f3347e0c2d58?w=500'
    ),
    
    -- Pre-Workout (3 products)
    (
        N'Pre-Workout Extreme - Fruit Punch',
        N'High-stimulant pre-workout. 300mg caffeine, beta-alanine, citrulline malate. Explosive energy and pump. Enhanced focus and endurance.',
        CAST(650000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=500'
    ),
    (
        N'Pre-Workout Pump - Blue Raspberry',
        N'Stimulant-free pump formula. Maximize blood flow and muscle pumps. L-arginine, citrulline, beetroot extract. Great for evening workouts.',
        CAST(580000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=500'
    ),
    (
        N'Pre-Workout Focus - Green Apple',
        N'Balanced energy and focus. 250mg caffeine, nootropics, electrolytes. Smooth energy without crash. 30 servings.',
        CAST(600000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1556817411-58c45dd94e8c?w=500'
    ),
    
    -- BCAA (3 products)
    (
        N'BCAA 2:1:1 - Watermelon',
        N'Branch Chain Amino Acids 2:1:1 ratio. 5g BCAAs per serving. Supports muscle recovery and reduces fatigue. Refreshing watermelon flavor.',
        CAST(450000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1534368420702-00fa0cd5a7dc?w=500'
    ),
    (
        N'BCAA + Electrolytes - Lemon Lime',
        N'BCAAs with added electrolytes. Perfect for intra-workout hydration. 7g BCAAs, essential minerals. Sugar-free formula.',
        CAST(520000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=500'
    ),
    (
        N'BCAA Energy - Mixed Berry',
        N'BCAAs with natural caffeine. 6g BCAAs, 100mg caffeine. Boost energy and recovery during training. Delicious mixed berry taste.',
        CAST(550000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=500'
    ),
    
    -- Multivitamin (2 products)
    (
        N'Multi-Vitamin for Men - Daily Pack',
        N'Complete multivitamin formula for active men. 24 essential vitamins and minerals. Supports immune system, energy, and muscle function. 30 packs.',
        CAST(380000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1579722820308-d74e571900a9?w=500'
    ),
    (
        N'Multi-Vitamin for Athletes - Tablets',
        N'High-potency multivitamin for athletes. Enhanced B-complex, antioxidants, minerals. Supports recovery and performance. 90 tablets.',
        CAST(420000 AS DECIMAL(12,2)),
        N'https://images.unsplash.com/photo-1622484211126-f3347e0c2d58?w=500'
    )
) AS v(ProductName, Description, Price, ImageUrl)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Products p WHERE p.ProductName = v.ProductName
);

GO

-- Verify insertion
SELECT 
    ProductID,
    ProductName,
    Price,
    IsActive,
    CreatedAt
FROM dbo.Products
ORDER BY CreatedAt DESC;

PRINT '✅ Successfully inserted 20 sample gym supplement products!';
PRINT '✅ All products have IsActive = 1 (visible to Admin and Customer)';
PRINT '✅ Products include: Whey (4), Creatine (4), Mass Gainer (4), Pre-Workout (3), BCAA (3), Multivitamin (2)';
GO
