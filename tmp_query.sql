USE GymCore;
GO
DECLARE @userId INT = 4;
SELECT TOP (1)
    cm.CustomerMembershipID,
    CASE
        WHEN cm.EndDate < CAST(GETDATE() AS DATE) THEN 'EXPIRED'
        ELSE cm.Status
    END AS Status,
    cm.StartDate,
    cm.EndDate,
    cm.CreatedAt AS MembershipCreatedAt,
    mp.MembershipPlanID,
    mp.PlanName,
    mp.PlanType,
    mp.Price,
    mp.DurationDays,
    mp.AllowsCoachBooking,
    pay.PaymentID,
    pay.Status AS PaymentStatus,
    pay.PaymentMethod AS PaymentMethod,
    pay.PayOS_Status,
    pay.PayOS_CheckoutUrl,
    pay.OriginalAmount AS OriginalAmount,
    pay.DiscountAmount AS DiscountAmount,
    pay.Amount AS PaymentAmount,
    pay.ClaimID AS ClaimID,
    pay.PromoCode AS PromoCode,
    pay.ApplyTarget AS ApplyTarget,
    pay.BonusDurationMonths AS BonusDurationMonths,
    pay.CreatedAt AS PaymentCreatedAt
FROM dbo.CustomerMemberships cm
JOIN dbo.MembershipPlans mp ON mp.MembershipPlanID = cm.MembershipPlanID
OUTER APPLY (
    SELECT TOP (1)
        p.PaymentID,
        p.Status,
        p.PaymentMethod,
        p.PayOS_Status,
        p.PayOS_CheckoutUrl,
        p.OriginalAmount,
        p.DiscountAmount,
        p.Amount,
        p.ClaimID,
        promo.PromoCode,
        promo.ApplyTarget,
        promo.BonusDurationMonths,
        p.CreatedAt
    FROM dbo.Payments p
    LEFT JOIN dbo.UserPromotionClaims c ON c.ClaimID = p.ClaimID
    LEFT JOIN dbo.Promotions promo ON promo.PromotionID = c.PromotionID
    WHERE p.CustomerMembershipID = cm.CustomerMembershipID
    ORDER BY p.PaymentID DESC
) pay
WHERE cm.CustomerID = @userId
  AND (
      cm.Status IN ('ACTIVE', 'SCHEDULED', 'EXPIRED')
      OR cm.EndDate < CAST(GETDATE() AS DATE)
  )
ORDER BY
    CASE
        WHEN cm.EndDate >= CAST(GETDATE() AS DATE) AND cm.Status = 'ACTIVE' THEN 1
        WHEN cm.Status = 'SCHEDULED' THEN 2
        WHEN cm.EndDate < CAST(GETDATE() AS DATE) THEN 3
        WHEN cm.Status = 'EXPIRED' THEN 3
        ELSE 4
    END,
    cm.EndDate DESC,
    cm.CustomerMembershipID DESC;
GO
