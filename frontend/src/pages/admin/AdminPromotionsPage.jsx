import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminPromotionApi } from '../../features/promotion/api/adminPromotionApi'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav } from '../../config/navigation'
import { Plus, Edit, Ticket, Image as ImageIcon, CheckCircle, XCircle, CircleOff, Calendar, FileText, Layout, Sparkles, Percent, BadgeDollarSign, Gift, Target, TicketPercent, Search, Check, ChevronDown, ShieldCheck, Upload, Trash2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import ConfirmDialog from '../../components/common/ConfirmDialog'

const POST_BANNER_MAX_BYTES = 5 * 1024 * 1024
const MAX_COUPON_DISCOUNT_PERCENT = 100
const MAX_COUPON_DISCOUNT_AMOUNT = 9999999999.99
const DECIMAL_INPUT_PATTERN = /^\d+(\.\d{1,2})?$/
const WHOLE_NUMBER_INPUT_PATTERN = /^\d+$/
const ADMIN_PROMOTIONS_ACTIVE_TAB_KEY = 'gymcore.admin.promotions.activeTab'

function toOptionalNumber(value) {
  if (value == null) return null
  const text = String(value).trim()
  if (!text) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

function parseCouponDecimalInput(value, { fieldLabel, required = false, maxValue = null, valueLabel = fieldLabel } = {}) {
  const text = String(value ?? '').trim()
  if (!text) {
    return required
      ? { value: null, error: `${fieldLabel} is required.` }
      : { value: null, error: '' }
  }
  if (!DECIMAL_INPUT_PATTERN.test(text)) {
    return { value: null, error: `${fieldLabel} must be a valid number with up to 2 decimal places.` }
  }
  const parsed = Number(text)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { value: null, error: `${fieldLabel} must be greater than 0.` }
  }
  if (maxValue != null && parsed > maxValue) {
    return { value: null, error: `${fieldLabel} must be at most ${valueLabel}.` }
  }
  return { value: parsed, error: '' }
}

function parseCouponWholeNumberInput(value, { fieldLabel, required = false } = {}) {
  const text = String(value ?? '').trim()
  if (!text) {
    return required
      ? { value: null, error: `${fieldLabel} is required.` }
      : { value: 0, error: '' }
  }
  if (!WHOLE_NUMBER_INPUT_PATTERN.test(text)) {
    return { value: null, error: `${fieldLabel} must be a whole number.` }
  }
  const parsed = Number.parseInt(text, 10)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) {
    return { value: null, error: `${fieldLabel} must be 0 or greater.` }
  }
  return { value: parsed, error: '' }
}

function formatCouponBenefit(coupon) {
  const bonusMonths = Number(coupon?.BonusDurationMonths || 0)
  const discountPercent = toOptionalNumber(coupon?.DiscountPercent)
  const discountAmount = toOptionalNumber(coupon?.DiscountAmount)
  const applyTarget = String(coupon?.ApplyTarget || 'ORDER').toUpperCase()
  const parts = []
  if (discountPercent != null && discountPercent > 0) {
    parts.push(`${discountPercent}% off`)
  } else if (discountAmount != null && discountAmount > 0) {
    parts.push(`${discountAmount.toLocaleString()} VND off`)
  }
  if (bonusMonths > 0) {
    parts.push(`+${bonusMonths} membership month${bonusMonths > 1 ? 's' : ''}`)
  }
  const benefit = parts.length > 0 ? parts.join(' + ') : 'No benefit configured'
  return `${applyTarget}: ${benefit}`
}

function formatDateInput(value) {
  if (!value) return ''
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear()
    const month = String(parsed.getMonth() + 1).padStart(2, '0')
    const day = String(parsed.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return String(value).split('T')[0] || ''
}

function getApiErrorMessage(error, fallbackMessage) {
  return error?.response?.data?.message || error?.response?.data?.error || error?.message || fallbackMessage
}

function createEmptyCouponForm() {
  return {
    promoCode: '',
    description: '',
    applyTarget: 'ORDER',
    discountMode: 'percent',
    discountPercent: '',
    discountAmount: '',
    bonusDurationMonths: '0',
    validFrom: '',
    validTo: '',
    isActive: true,
  }
}

function mapCouponToForm(coupon) {
  const discountPercent = coupon?.DiscountPercent != null ? String(coupon.DiscountPercent) : ''
  const discountAmount = coupon?.DiscountAmount != null ? String(coupon.DiscountAmount) : ''
  return {
    promoCode: coupon?.PromoCode || '',
    description: coupon?.Description || '',
    applyTarget: coupon?.ApplyTarget || 'ORDER',
    discountMode: discountPercent ? 'percent' : discountAmount ? 'amount' : 'none',
    discountPercent,
    discountAmount,
    bonusDurationMonths: String(coupon?.BonusDurationMonths ?? 0),
    validFrom: formatDateInput(coupon?.ValidFrom),
    validTo: formatDateInput(coupon?.ValidTo),
    isActive: coupon ? coupon.IsActive === 1 || coupon.IsActive === true : true,
  }
}

function createEmptyPostForm() {
  return {
    title: '',
    content: '',
    bannerUrl: '',
    promotionId: '',
    startAt: '',
    endAt: '',
    isActive: true,
    isImportant: false,
  }
}

function mapPostToForm(post) {
  return {
    title: post?.Title || '',
    content: post?.Content || '',
    bannerUrl: post?.BannerUrl || '',
    promotionId: post?.PromotionID ? String(post.PromotionID) : '',
    startAt: formatDateInput(post?.StartAt),
    endAt: formatDateInput(post?.EndAt),
    isActive: post ? (post.IsActive === 1 || post.IsActive === true) : true,
    isImportant: post ? (post.IsImportant === 1 || post.IsImportant === true) : false,
  }
}

function SummaryCard({ label, value, icon, tone = 'slate' }) {
  const IconComponent = icon
  const toneClasses = {
    slate: 'bg-slate-50 text-slate-700',
    green: 'bg-green-50 text-green-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
        </div>
        <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${toneClasses[tone] || toneClasses.slate}`}>
          <IconComponent size={20} />
        </span>
      </div>
    </div>
  )
}

const AdminPromotionsPage = () => {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'coupons'
    const savedTab = window.sessionStorage.getItem(ADMIN_PROMOTIONS_ACTIVE_TAB_KEY)
    return savedTab === 'posts' ? 'posts' : 'coupons'
  })
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false)
  const [isPostModalOpen, setIsPostModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [couponForm, setCouponForm] = useState(createEmptyCouponForm())
  const [postForm, setPostForm] = useState(createEmptyPostForm())
  const [couponFormError, setCouponFormError] = useState('')
  const [postFormError, setPostFormError] = useState('')
  const [couponSearch, setCouponSearch] = useState('')
  const [couponTargetFilter, setCouponTargetFilter] = useState('all')
  const [couponStatusFilter, setCouponStatusFilter] = useState('all')
  const [couponBenefitFilter, setCouponBenefitFilter] = useState('all')
  const [postSearch, setPostSearch] = useState('')
  const [postStatusFilter, setPostStatusFilter] = useState('all')
  const [postTargetFilter, setPostTargetFilter] = useState('all')
  const [postCouponSearch, setPostCouponSearch] = useState('')
  const [isPostCouponPickerOpen, setIsPostCouponPickerOpen] = useState(false)
  const [isUploadingPostBanner, setIsUploadingPostBanner] = useState(false)
  const [postBannerPreviewUrl, setPostBannerPreviewUrl] = useState('')
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    kind: '',
    id: null,
    title: '',
    description: '',
  })

  // Queries
  const { data: couponsData, isLoading: loadingCoupons } = useQuery({
    queryKey: ['adminCoupons'],
    queryFn: () => adminPromotionApi.getCoupons(),
  })

  const { data: postsData, isLoading: loadingPosts } = useQuery({
    queryKey: ['adminPosts'],
    queryFn: () => adminPromotionApi.getPosts(),
  })

  // Mutations
  const createCouponMutation = useMutation({
    mutationFn: (payload) => adminPromotionApi.createCoupon(payload),
    onSuccess: () => {
      toast.success('Coupon created')
      queryClient.invalidateQueries({ queryKey: ['adminCoupons'] })
      setIsCouponModalOpen(false)
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, 'Failed to create coupon')
      setCouponFormError(message)
      toast.error(message)
    },
  })

  const updateCouponMutation = useMutation({
    mutationFn: ({ id, payload }) => adminPromotionApi.updateCoupon(id, payload),
    onSuccess: () => {
      toast.success('Coupon updated')
      queryClient.invalidateQueries({ queryKey: ['adminCoupons'] })
      setIsCouponModalOpen(false)
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, 'Failed to update coupon')
      setCouponFormError(message)
      toast.error(message)
    },
  })

  const deleteCouponMutation = useMutation({
    mutationFn: (id) => adminPromotionApi.deleteCoupon(id),
    onSuccess: () => {
      toast.success('Coupon deactivated')
      queryClient.invalidateQueries({ queryKey: ['adminCoupons'] })
    },
  })

  const createPostMutation = useMutation({
    mutationFn: (payload) => adminPromotionApi.createPost(payload),
    onSuccess: () => {
      toast.success('Promotion post created')
      queryClient.invalidateQueries({ queryKey: ['adminPosts'] })
      setIsPostModalOpen(false)
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, 'Failed to create promotion post')
      setPostFormError(message)
      toast.error(message)
    },
  })

  const updatePostMutation = useMutation({
    mutationFn: ({ id, payload }) => adminPromotionApi.updatePost(id, payload),
    onSuccess: () => {
      toast.success('Promotion post updated')
      queryClient.invalidateQueries({ queryKey: ['adminPosts'] })
      setIsPostModalOpen(false)
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, 'Failed to update promotion post')
      setPostFormError(message)
      toast.error(message)
    },
  })

  const deletePostMutation = useMutation({
    mutationFn: (id) => adminPromotionApi.deletePost(id),
    onSuccess: () => {
      toast.success('Marketing post deactivated')
      queryClient.invalidateQueries({ queryKey: ['adminPosts'] })
    },
  })

  const uploadBannerMutation = useMutation({
    mutationFn: ({ file }) => adminPromotionApi.uploadBanner(file),
    onSuccess: async (response, variables) => {
      const uploadedUrl = response?.imageUrl || ''
      setPostForm((prev) => ({ ...prev, bannerUrl: uploadedUrl }))
      setPostFormError('')
      setIsUploadingPostBanner(false)
      const previousUrl = variables?.previousUrl || ''
      if (isManagedPromotionBanner(previousUrl) && previousUrl !== uploadedUrl) {
        await adminPromotionApi.deleteUploadedBanner(previousUrl).catch(() => {})
      }
    },
    onError: (error) => {
      setIsUploadingPostBanner(false)
      if (postBannerPreviewUrl && postBannerPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(postBannerPreviewUrl)
      }
      setPostBannerPreviewUrl('')
      const status = error?.response?.status
      const message = error?.response?.data?.message
        || error?.response?.data?.error
        || (status === 413 ? 'Promotion banner file is too large. Maximum size is 5 MB.' : '')
        || error?.message
        || 'Banner upload failed'
      toast.error(message)
    },
  })

  useEffect(() => {
    return () => {
      if (postBannerPreviewUrl && postBannerPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(postBannerPreviewUrl)
      }
    }
  }, [postBannerPreviewUrl])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(ADMIN_PROMOTIONS_ACTIVE_TAB_KEY, activeTab)
  }, [activeTab])

  const coupons = useMemo(() => couponsData?.data?.coupons ?? [], [couponsData])
  const posts = useMemo(() => postsData?.data?.posts ?? [], [postsData])
  const portalRoot = typeof document !== 'undefined' ? document.body : null
  const couponMap = useMemo(
    () => new Map(coupons.map((coupon) => [Number(coupon.PromotionID), coupon])),
    [coupons],
  )

  const couponSummary = useMemo(() => {
    const activeCoupons = coupons.filter((coupon) => coupon.IsActive)
    const membershipCoupons = coupons.filter((coupon) => String(coupon.ApplyTarget).toUpperCase() === 'MEMBERSHIP')
    const orderCoupons = coupons.filter((coupon) => String(coupon.ApplyTarget).toUpperCase() === 'ORDER')
    return {
      total: coupons.length,
      active: activeCoupons.length,
      membership: membershipCoupons.length,
      order: orderCoupons.length,
    }
  }, [coupons])

  const selectedPostCoupon = useMemo(
    () => coupons.find((coupon) => String(coupon.PromotionID) === String(postForm.promotionId)) ?? null,
    [coupons, postForm.promotionId],
  )

  const filteredCoupons = useMemo(() => {
    const search = couponSearch.trim().toLowerCase()
    return coupons.filter((coupon) => {
      const applyTarget = String(coupon.ApplyTarget || 'ORDER').toUpperCase()
      const isActive = Boolean(coupon.IsActive)
      const hasPercent = toOptionalNumber(coupon.DiscountPercent) > 0
      const hasAmount = toOptionalNumber(coupon.DiscountAmount) > 0
      const hasDiscount = hasPercent || hasAmount
      const hasBonus = Number(coupon.BonusDurationMonths || 0) > 0

      if (couponTargetFilter !== 'all' && applyTarget !== couponTargetFilter) return false
      if (couponStatusFilter === 'active' && !isActive) return false
      if (couponStatusFilter === 'inactive' && isActive) return false
      if (couponBenefitFilter === 'discount' && (!hasDiscount || hasBonus)) return false
      if (couponBenefitFilter === 'bonus' && (hasDiscount || !hasBonus)) return false
      if (couponBenefitFilter === 'combo' && !(hasDiscount && hasBonus)) return false

      if (!search) return true
      const haystack = [
        coupon.PromoCode,
        coupon.Description,
        applyTarget,
        formatCouponBenefit(coupon),
      ].join(' ').toLowerCase()
      return haystack.includes(search)
    })
  }, [couponBenefitFilter, couponSearch, couponStatusFilter, couponTargetFilter, coupons])

  const filteredPosts = useMemo(() => {
    const search = postSearch.trim().toLowerCase()
    return posts.filter((post) => {
      const isActive = Boolean(post.IsActive)
      const linkedCoupon = couponMap.get(Number(post.PromotionID))
      const applyTarget = String(linkedCoupon?.ApplyTarget || '').toUpperCase()

      if (postStatusFilter === 'active' && !isActive) return false
      if (postStatusFilter === 'inactive' && isActive) return false
      if (postTargetFilter !== 'all' && applyTarget !== postTargetFilter) return false

      if (!search) return true
      const haystack = [
        post.Title,
        post.Content,
        post.PromoCode,
        applyTarget,
      ].join(' ').toLowerCase()
      return haystack.includes(search)
    })
  }, [couponMap, postSearch, postStatusFilter, postTargetFilter, posts])

  const availablePostCoupons = useMemo(() => {
    const linkedPromotionIds = new Set(
      posts
        .filter((post) => !editingItem || post.PromotionPostID !== editingItem.PromotionPostID)
        .map((post) => Number(post.PromotionID)),
    )
    const search = postCouponSearch.trim().toLowerCase()

    return coupons
      .filter((coupon) => coupon.IsActive === 1 || coupon.IsActive === true)
      .filter((coupon) => !linkedPromotionIds.has(Number(coupon.PromotionID)))
      .filter((coupon) => {
        if (!search) return true
        const haystack = [
          coupon.PromoCode,
          coupon.Description,
          formatCouponBenefit(coupon),
        ].join(' ').toLowerCase()
        return haystack.includes(search)
      })
  }, [coupons, editingItem, postCouponSearch, posts])

  const liveCouponBenefit = useMemo(() => {
    const parts = []
    const parsedPercent = parseCouponDecimalInput(couponForm.discountPercent, {
      fieldLabel: 'Discount percent',
      maxValue: MAX_COUPON_DISCOUNT_PERCENT,
      valueLabel: '100',
    })
    const parsedAmount = parseCouponDecimalInput(couponForm.discountAmount, {
      fieldLabel: 'Discount amount',
      maxValue: MAX_COUPON_DISCOUNT_AMOUNT,
      valueLabel: '9,999,999,999.99 VND',
    })
    const parsedBonusMonths = parseCouponWholeNumberInput(couponForm.bonusDurationMonths, {
      fieldLabel: 'Bonus membership months',
    })
    const bonusMonths = parsedBonusMonths.error ? 0 : parsedBonusMonths.value

    if (couponForm.discountMode === 'percent' && !parsedPercent.error && parsedPercent.value > 0) {
      parts.push(`${parsedPercent.value}% off`)
    }
    if (couponForm.discountMode === 'amount' && !parsedAmount.error && parsedAmount.value > 0) {
      parts.push(`${parsedAmount.value.toLocaleString()} VND off`)
    }
    if (couponForm.applyTarget === 'MEMBERSHIP' && bonusMonths > 0) {
      parts.push(`+${bonusMonths} membership month${bonusMonths > 1 ? 's' : ''}`)
    }
    return parts.length ? parts.join(' + ') : 'No benefit selected yet'
  }, [couponForm])

  function openCouponModal(coupon = null) {
    setActiveTab('coupons')
    setEditingItem(coupon)
    setCouponForm(coupon ? mapCouponToForm(coupon) : createEmptyCouponForm())
    setCouponFormError('')
    setIsCouponModalOpen(true)
  }

  function closeCouponModal() {
    setIsCouponModalOpen(false)
    setCouponFormError('')
  }

  function openPostModal(post = null) {
    setActiveTab('posts')
    setEditingItem(post)
    setPostForm(post ? mapPostToForm(post) : createEmptyPostForm())
    setPostBannerPreviewUrl('')
    setPostCouponSearch('')
    setIsPostCouponPickerOpen(false)
    setPostFormError('')
    setIsPostModalOpen(true)
  }

  function closePostModal() {
    if (postBannerPreviewUrl && postBannerPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(postBannerPreviewUrl)
    }
    setPostBannerPreviewUrl('')
    setIsPostModalOpen(false)
    setPostFormError('')
    setIsPostCouponPickerOpen(false)
  }

  function updateCouponForm(field, value) {
    setCouponForm((prev) => ({ ...prev, [field]: value }))
    setCouponFormError('')
  }

  function updatePostForm(field, value) {
    setPostForm((prev) => ({ ...prev, [field]: value }))
    setPostFormError('')
  }

  function isManagedPromotionBanner(imageUrl) {
    return typeof imageUrl === 'string' && imageUrl.startsWith('/uploads/promotions/')
  }

  function handlePostBannerUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > POST_BANNER_MAX_BYTES) {
      toast.error('Promotion banner file is too large. Maximum size is 5 MB.')
      return
    }
    if (postBannerPreviewUrl && postBannerPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(postBannerPreviewUrl)
    }
    setPostBannerPreviewUrl(URL.createObjectURL(file))
    setIsUploadingPostBanner(true)
    uploadBannerMutation.mutate({
      file,
      previousUrl: postForm.bannerUrl || '',
    })
  }

  async function removePostBanner() {
    const previousUrl = postForm.bannerUrl || ''
    if (isManagedPromotionBanner(previousUrl)) {
      await adminPromotionApi.deleteUploadedBanner(previousUrl).catch(() => {})
    }
    if (postBannerPreviewUrl && postBannerPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(postBannerPreviewUrl)
    }
    setPostBannerPreviewUrl('')
    setPostForm((prev) => ({ ...prev, bannerUrl: '' }))
    setPostFormError('')
  }

  const effectivePostBannerPreview = postBannerPreviewUrl || postForm.bannerUrl

  function handleApplyTargetChange(targetValue) {
    setCouponForm((prev) => ({
      ...prev,
      applyTarget: targetValue,
      bonusDurationMonths: targetValue === 'ORDER' ? '0' : prev.bonusDurationMonths,
    }))
    setCouponFormError('')
  }

  function handleDiscountModeChange(mode) {
    setCouponForm((prev) => ({
      ...prev,
      discountMode: mode,
      discountPercent: mode === 'percent' ? prev.discountPercent : '',
      discountAmount: mode === 'amount' ? prev.discountAmount : '',
    }))
    setCouponFormError('')
  }

  function handlePostCouponSelect(coupon) {
    if (!coupon) return
    setPostForm((prev) => ({
      ...prev,
      promotionId: String(coupon.PromotionID),
      startAt: formatDateInput(coupon.ValidFrom),
      endAt: formatDateInput(coupon.ValidTo),
    }))
    setPostCouponSearch('')
    setIsPostCouponPickerOpen(false)
    setPostFormError('')
  }

  function buildCouponPayload() {
    const parsedPercent = parseCouponDecimalInput(couponForm.discountPercent, {
      fieldLabel: 'Discount percent',
      required: couponForm.discountMode === 'percent',
      maxValue: MAX_COUPON_DISCOUNT_PERCENT,
      valueLabel: '100',
    })
    const parsedAmount = parseCouponDecimalInput(couponForm.discountAmount, {
      fieldLabel: 'Discount amount',
      required: couponForm.discountMode === 'amount',
      maxValue: MAX_COUPON_DISCOUNT_AMOUNT,
      valueLabel: '9,999,999,999.99 VND',
    })
    const parsedBonusMonths = parseCouponWholeNumberInput(couponForm.bonusDurationMonths, {
      fieldLabel: 'Bonus membership months',
      required: false,
    })

    return {
      promoCode: couponForm.promoCode.trim(),
      description: couponForm.description.trim(),
      applyTarget: couponForm.applyTarget,
      discountPercent: couponForm.discountMode === 'percent' ? parsedPercent.value : null,
      discountAmount: couponForm.discountMode === 'amount' ? parsedAmount.value : null,
      bonusDurationMonths: couponForm.applyTarget === 'MEMBERSHIP' ? parsedBonusMonths.value : 0,
      validFrom: couponForm.validFrom,
      validTo: couponForm.validTo,
      isActive: couponForm.isActive ? 1 : 0,
      validation: {
        discountPercent: parsedPercent,
        discountAmount: parsedAmount,
        bonusDurationMonths: parsedBonusMonths,
      },
    }
  }

  function validateCouponPayload(payload) {
    if (!payload.promoCode) return 'Coupon code is required.'
    if (!payload.validFrom || !payload.validTo) return 'Valid from and valid to are required.'
    if (payload.validTo < payload.validFrom) return 'Valid to must be on or after valid from.'
    if (payload.discountPercent == null && payload.validation.discountPercent.error && couponForm.discountMode === 'percent') {
      return payload.validation.discountPercent.error
    }
    if (payload.discountAmount == null && payload.validation.discountAmount.error && couponForm.discountMode === 'amount') {
      return payload.validation.discountAmount.error
    }
    if (payload.applyTarget === 'MEMBERSHIP' && payload.validation.bonusDurationMonths.error) {
      return payload.validation.bonusDurationMonths.error
    }
    if (payload.discountPercent != null && payload.discountPercent > MAX_COUPON_DISCOUNT_PERCENT) {
      return 'Discount percent must be between 0 and 100.'
    }
    if (payload.applyTarget === 'ORDER' && payload.bonusDurationMonths > 0) return 'Product-order coupons cannot include bonus membership months.'
    const hasDiscountPercent = payload.discountPercent != null && payload.discountPercent > 0
    const hasDiscountAmount = payload.discountAmount != null && payload.discountAmount > 0
    const hasBonusMonths = payload.bonusDurationMonths > 0
    if (!hasDiscountPercent && !hasDiscountAmount && !hasBonusMonths) {
      return 'Choose at least one real benefit before saving the coupon.'
    }
    return ''
  }

  function submitCouponForm(event) {
    event.preventDefault()
    const payload = buildCouponPayload()
    const validationError = validateCouponPayload(payload)
    if (validationError) {
      setCouponFormError(validationError)
      return
    }

    if (editingItem) {
      updateCouponMutation.mutate({ id: editingItem.PromotionID, payload: { ...editingItem, ...payload } })
    } else {
      createCouponMutation.mutate(payload)
    }
  }

  function validatePostPayload(payload) {
    if (!payload.title?.trim()) return 'Post title is required.'
    if (!payload.content?.trim()) return 'Post content is required.'
    if (!payload.bannerUrl?.trim()) return 'Banner image is required.'
    if (!payload.promotionId) return 'Choose a coupon to link with this marketing post.'
    if (!payload.startAt || !payload.endAt) return 'Start and end dates are required.'
    if (payload.endAt < payload.startAt) return 'End date must be on or after start date.'
    return ''
  }

  function submitPostForm(event) {
    event.preventDefault()
    const payload = {
      title: postForm.title.trim(),
      content: postForm.content.trim(),
      bannerUrl: postForm.bannerUrl.trim(),
      promotionId: postForm.promotionId ? parseInt(postForm.promotionId, 10) : null,
      startAt: postForm.startAt,
      endAt: postForm.endAt,
      isActive: postForm.isActive ? 1 : 0,
      isImportant: postForm.isImportant ? 1 : 0,
    }

    const validationError = validatePostPayload(payload)
    if (validationError) {
      setPostFormError(validationError)
      return
    }

    if (editingItem) {
      updatePostMutation.mutate({ id: editingItem.PromotionPostID, payload: { ...editingItem, ...payload } })
    } else {
      createPostMutation.mutate(payload)
    }
  }

  function openDeactivateDialog(kind, id, title, description) {
    setConfirmDialog({
      open: true,
      kind,
      id,
      title,
      description,
    })
  }

  function closeDeactivateDialog() {
    setConfirmDialog({
      open: false,
      kind: '',
      id: null,
      title: '',
      description: '',
    })
  }

  function confirmDeactivateDialog() {
    if (!confirmDialog.id) return
    if (confirmDialog.kind === 'coupon') {
      deleteCouponMutation.mutate(confirmDialog.id, {
        onSettled: closeDeactivateDialog,
      })
      return
    }
    if (confirmDialog.kind === 'post') {
      deletePostMutation.mutate(confirmDialog.id, {
        onSettled: closeDeactivateDialog,
      })
    }
  }

  return (
    <WorkspaceScaffold
      title="Promotions Management"
      subtitle="Create and manage discount coupons and marketing campaign posts."
      links={adminNav}
    >
      <div className="space-y-8">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('coupons')}
            className={`px-6 py-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'coupons' ? 'border-gym-600 text-gym-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
          >
            <Ticket size={16} /> Discount Coupons
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={`px-6 py-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'posts' ? 'border-gym-600 text-gym-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
          >
            <Layout size={16} /> Marketing Posts
          </button>
        </div>

        {activeTab === 'coupons' && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Total coupons" value={couponSummary.total} icon={TicketPercent} tone="slate" />
              <SummaryCard label="Active now" value={couponSummary.active} icon={CheckCircle} tone="green" />
              <SummaryCard label="Product-order coupons" value={couponSummary.order} icon={Target} tone="blue" />
              <SummaryCard label="Membership coupons" value={couponSummary.membership} icon={Gift} tone="amber" />
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Ticket className="text-gym-600" size={20} />
                Active Coupons
              </h3>
              <button
                onClick={() => openCouponModal()}
                className="bg-gym-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-gym-700 transition-all"
              >
                <Plus size={16} /> Create Coupon
              </button>
            </div>

            <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 px-6 py-4 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <Search size={14} className="text-slate-400" />
                <input
                  type="text"
                  value={couponSearch}
                  onChange={(event) => setCouponSearch(event.target.value)}
                  placeholder="Search code, description, or benefit"
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              </label>
              <select
                aria-label="Coupon target filter"
                value={couponTargetFilter}
                onChange={(event) => setCouponTargetFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option value="all">All targets</option>
                <option value="ORDER">Product order</option>
                <option value="MEMBERSHIP">Membership</option>
              </select>
              <select
                aria-label="Coupon status filter"
                value={couponStatusFilter}
                onChange={(event) => setCouponStatusFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option value="all">All statuses</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
              <select
                aria-label="Coupon benefit filter"
                value={couponBenefitFilter}
                onChange={(event) => setCouponBenefitFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option value="all">All benefit types</option>
                <option value="discount">Discount only</option>
                <option value="bonus">Bonus months only</option>
                <option value="combo">Discount + bonus</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-bold">Code</th>
                    <th className="px-6 py-4 font-bold">Target</th>
                    <th className="px-6 py-4 font-bold">Benefit</th>
                    <th className="px-6 py-4 font-bold">Validity</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loadingCoupons ? (
                    <tr><td colSpan="6" className="p-10 text-center text-slate-400">Loading coupons...</td></tr>
                  ) : filteredCoupons.length === 0 ? (
                    <tr><td colSpan="6" className="p-10 text-center text-slate-400">No coupons match the current filters.</td></tr>
                  ) : filteredCoupons.map(coupon => (
                    <tr key={coupon.PromotionID} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-gym-600 bg-gym-50 px-2 py-1 rounded">
                          {coupon.PromoCode}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${String(coupon.ApplyTarget).toUpperCase() === 'MEMBERSHIP' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                          {String(coupon.ApplyTarget).toUpperCase() === 'MEMBERSHIP' ? 'Membership' : 'Product order'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-900">
                          {formatCouponBenefit(coupon).replace(/^(ORDER|MEMBERSHIP):\s*/, '')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(coupon.ValidFrom).toLocaleDateString()} - {new Date(coupon.ValidTo).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {coupon.IsActive ? (
                          <span className="flex items-center gap-1 text-green-600 text-xs font-bold bg-green-50 px-2 py-0.5 rounded-full w-fit">
                            <CheckCircle size={12} /> Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-400 text-xs font-bold bg-slate-100 px-2 py-0.5 rounded-full w-fit">
                            <XCircle size={12} /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <button
                          onClick={() => openCouponModal(coupon)}
                          className="p-2 text-slate-400 hover:text-gym-600 hover:bg-gym-50 rounded-lg transition-all"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => openDeactivateDialog(
                            'coupon',
                            coupon.PromotionID,
                            `Deactivate ${coupon.PromoCode}?`,
                            'This coupon will stop being claimable and usable at checkout. Existing claim history stays in the system.',
                          )}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <CircleOff size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        )}

        {activeTab === 'posts' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <ImageIcon className="text-gym-600" size={20} />
                Marketing Posts
              </h3>
              <button
                onClick={() => openPostModal()}
                className="bg-gym-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-gym-700 transition-all"
              >
                <Plus size={16} /> Create Post
              </button>
            </div>

            <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 px-6 py-4 lg:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(0,1fr))]">
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <Search size={14} className="text-slate-400" />
                <input
                  type="text"
                  value={postSearch}
                  onChange={(event) => setPostSearch(event.target.value)}
                  placeholder="Search title, content, or coupon"
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              </label>
              <select
                aria-label="Post status filter"
                value={postStatusFilter}
                onChange={(event) => setPostStatusFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option value="all">All post statuses</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
              <select
                aria-label="Post target filter"
                value={postTargetFilter}
                onChange={(event) => setPostTargetFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option value="all">All linked targets</option>
                <option value="ORDER">Product order</option>
                <option value="MEMBERSHIP">Membership</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-bold">Post Info</th>
                    <th className="px-6 py-4 font-bold">Target Coupon</th>
                    <th className="px-6 py-4 font-bold">Duration</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loadingPosts ? (
                    <tr><td colSpan="5" className="p-10 text-center text-slate-400">Loading posts...</td></tr>
                  ) : filteredPosts.length === 0 ? (
                    <tr><td colSpan="5" className="p-10 text-center text-slate-400">No promotion posts match the current filters.</td></tr>
                  ) : filteredPosts.map(post => (
                    <tr key={post.PromotionPostID} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {post.BannerUrl ? (
                            <img src={post.BannerUrl} className="w-10 h-10 object-cover rounded-md" alt="" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-400">
                              <ImageIcon size={16} />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{post.Title}</p>
                            <p className="text-xs text-slate-500 line-clamp-1">{post.Content}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-bold text-gym-600 bg-gym-50 px-2 py-1 rounded">
                          {post.PromoCode}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(post.StartAt).toLocaleDateString()} - {new Date(post.EndAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          {post.IsActive ? (
                            <span className="flex items-center gap-1 text-green-600 text-xs font-bold bg-green-50 px-2 py-0.5 rounded-full w-fit">
                              <CheckCircle size={12} /> Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-slate-400 text-xs font-bold bg-slate-100 px-2 py-0.5 rounded-full w-fit">
                              <XCircle size={12} /> Inactive
                            </span>
                          )}
                          {post.IsImportant ? (
                            <span className="flex items-center gap-1 text-amber-700 text-xs font-bold bg-amber-50 px-2 py-0.5 rounded-full w-fit">
                              <ShieldCheck size={12} /> Broadcasts to all customers
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-slate-500 text-xs font-bold bg-slate-100 px-2 py-0.5 rounded-full w-fit">
                              <Layout size={12} /> Promotions page only
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <button
                          onClick={() => openPostModal(post)}
                          className="p-2 text-slate-400 hover:text-gym-600 hover:bg-gym-50 rounded-lg transition-all"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => openDeactivateDialog(
                            'post',
                            post.PromotionPostID,
                            `Deactivate ${post.Title}?`,
                            'This marketing post will disappear from the customer Promotions page, but the linked coupon itself will remain unchanged.',
                          )}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <CircleOff size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Coupon Modal */}
        {isCouponModalOpen && portalRoot ? createPortal((
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="coupon-modal-title"
              className="relative w-full max-w-[1240px] max-h-[92vh] overflow-hidden rounded-[2rem] bg-white shadow-2xl animate-in zoom-in-95"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-white px-8 py-6">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Coupon Builder</p>
                  <h3 id="coupon-modal-title" className="mt-1 font-extrabold text-slate-900 text-2xl">{editingItem ? 'Edit Coupon' : 'New Coupon'}</h3>
                </div>
                <button
                  type="button"
                  onClick={closeCouponModal}
                  aria-label="Close coupon modal"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50"
                >
                  <XCircle size={22} />
                </button>
              </div>
              <form noValidate className="max-h-[calc(92vh-88px)] overflow-y-auto px-8 py-8" onSubmit={submitCouponForm}>
                <div className="grid gap-8 xl:grid-cols-[1.55fr_1fr]">
                  <div className="space-y-6">
                    <section className="space-y-5 rounded-[1.75rem] border border-slate-100 bg-slate-50/80 p-6">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Coupon Basics</p>
                        <h4 className="mt-1 text-lg font-bold text-slate-900">Define the code and the audience</h4>
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="coupon-promo-code" className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Ticket size={12} /> Coupon Code</label>
                        <input id="coupon-promo-code" name="promoCode" value={couponForm.promoCode} onChange={(event) => updateCouponForm('promoCode', event.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 focus:ring-2 focus:ring-gym-200 outline-none transition-all font-mono" placeholder="WELCOME10" />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="coupon-description" className="text-xs font-bold text-slate-500 uppercase">Description</label>
                        <input id="coupon-description" name="description" value={couponForm.description} onChange={(event) => updateCouponForm('description', event.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" placeholder="10% off for first order" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Target size={12} /> Apply Target</label>
                        <div className="grid gap-4 lg:grid-cols-2">
                          {[
                            { value: 'ORDER', label: 'Product order', description: 'Use for supplements and checkout discounts.', icon: BadgeDollarSign },
                            { value: 'MEMBERSHIP', label: 'Membership', description: 'Use for plan discounts or bonus membership time.', icon: Gift },
                          ].map((option) => {
                            const Icon = option.icon
                            const selected = couponForm.applyTarget === option.value
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => handleApplyTargetChange(option.value)}
                                aria-label={`${option.label} ${option.description}`}
                                className={`rounded-[1.4rem] border p-5 text-left transition-all ${selected ? 'border-gym-500 bg-gym-50 ring-2 ring-gym-100 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${selected ? 'bg-gym-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                    <Icon size={18} />
                                  </span>
                                  <div>
                                    <p className="font-bold text-slate-900">{option.label}</p>
                                    <p className="text-xs text-slate-500">{option.description}</p>
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </section>

                    <section className="space-y-5 rounded-[1.75rem] border border-slate-100 bg-white p-6">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Benefit Design</p>
                        <h4 className="mt-1 text-lg font-bold text-slate-900">Choose one discount type, then add bonus time if needed</h4>
                      </div>
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-500 uppercase">Discount Model</label>
                        <div className="grid gap-4 xl:grid-cols-3">
                          {[
                            { value: 'none', label: 'No discount', description: 'Useful for bonus-month-only membership coupons.', icon: CircleOff },
                            { value: 'percent', label: 'Percent off', description: 'Use a percentage discount like 10% or 15%.', icon: Percent },
                            { value: 'amount', label: 'Fixed VND off', description: 'Use a flat VND discount like 50,000.', icon: BadgeDollarSign },
                          ].map((option) => {
                            const Icon = option.icon
                            const selected = couponForm.discountMode === option.value
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => handleDiscountModeChange(option.value)}
                                aria-label={`${option.label} ${option.description}`}
                                className={`rounded-[1.4rem] border p-5 text-left transition-all ${selected ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/10' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
                              >
                                <div className="flex items-start gap-3">
                                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${selected ? 'bg-white/15 text-white' : 'bg-white text-slate-600'}`}>
                                    <Icon size={18} />
                                  </span>
                                  <div>
                                    <p className={`font-bold ${selected ? 'text-white' : 'text-slate-900'}`}>{option.label}</p>
                                    <p className={`mt-1 text-xs ${selected ? 'text-slate-200' : 'text-slate-500'}`}>{option.description}</p>
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1">
                          <label htmlFor="coupon-discount-percent" className="text-xs font-bold text-slate-500 uppercase">Discount (%)</label>
                          <input id="coupon-discount-percent" name="discountPercent" type="text" inputMode="decimal" value={couponForm.discountPercent} onChange={(event) => updateCouponForm('discountPercent', event.target.value)} disabled={couponForm.discountMode !== 'percent'} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400" placeholder="10" />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="coupon-discount-amount" className="text-xs font-bold text-slate-500 uppercase">Discount (VND)</label>
                          <input id="coupon-discount-amount" name="discountAmount" type="text" inputMode="decimal" value={couponForm.discountAmount} onChange={(event) => updateCouponForm('discountAmount', event.target.value)} disabled={couponForm.discountMode !== 'amount'} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400" placeholder="50000" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="coupon-bonus-months" className="text-xs font-bold text-slate-500 uppercase">Bonus Membership Months</label>
                        <input id="coupon-bonus-months" name="bonusDurationMonths" type="text" inputMode="numeric" value={couponForm.bonusDurationMonths} onChange={(event) => updateCouponForm('bonusDurationMonths', event.target.value)} disabled={couponForm.applyTarget !== 'MEMBERSHIP'} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400" placeholder="0" />
                        <p className="text-xs text-slate-500">
                          {couponForm.applyTarget === 'MEMBERSHIP'
                            ? 'Membership coupons can give bonus time in addition to one discount type.'
                            : 'Bonus months are locked for product-order coupons.'}
                        </p>
                      </div>
                    </section>
                  </div>

                  <aside className="space-y-6 xl:sticky xl:top-0 xl:self-start">
                    <section className="rounded-[1.75rem] border border-gym-100 bg-gym-50 p-6">
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-gym-700">Live Preview</p>
                      <div className="mt-4 rounded-[1.4rem] bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                            {couponForm.applyTarget === 'MEMBERSHIP' ? 'Membership' : 'Product order'}
                          </span>
                          <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${couponForm.isActive ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {couponForm.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="mt-4 font-mono text-lg font-black text-slate-900">{couponForm.promoCode || 'CODE_PREVIEW'}</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{liveCouponBenefit}</p>
                        <p className="mt-2 text-sm text-slate-500">
                          {couponForm.description || 'Add a short internal/customer-facing description for this coupon.'}
                        </p>
                      </div>
                    </section>

                    <section className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-6 space-y-5">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Validity Window</p>
                        <h4 className="mt-1 text-lg font-bold text-slate-900">Schedule when this coupon can be claimed</h4>
                      </div>
                      <div className="grid gap-4">
                        <div className="space-y-1">
                          <label htmlFor="coupon-valid-from" className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Calendar size={12} /> Valid From</label>
                          <input id="coupon-valid-from" name="validFrom" type="date" value={couponForm.validFrom} onChange={(event) => updateCouponForm('validFrom', event.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="coupon-valid-to" className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Calendar size={12} /> Valid To</label>
                          <input id="coupon-valid-to" name="validTo" type="date" value={couponForm.validTo} onChange={(event) => updateCouponForm('validTo', event.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateCouponForm('isActive', !couponForm.isActive)}
                        className={`flex w-full items-center justify-between gap-4 rounded-[1.25rem] border px-4 py-4 text-left transition-all ${couponForm.isActive ? 'border-gym-200 bg-gym-50' : 'border-slate-200 bg-white'}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${couponForm.isActive ? 'bg-gym-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                            <ShieldCheck size={18} />
                          </span>
                          <div>
                            <p className="text-sm font-bold text-slate-900">Set as active</p>
                            <p className="text-xs text-slate-500">
                              {couponForm.isActive ? 'This coupon is currently live for customers.' : 'Keep this coupon saved but unavailable for claim/use.'}
                            </p>
                          </div>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${couponForm.isActive ? 'bg-gym-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {couponForm.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </button>
                      <div className="rounded-[1.4rem] border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                        <p className="font-bold">Coupon design rules</p>
                        <ul className="mt-2 space-y-1 text-xs text-blue-800 list-disc pl-4">
                          <li>Use one discount type at a time: percent or fixed VND.</li>
                          <li>Only membership coupons can include bonus months.</li>
                          <li>Every coupon must provide at least one real benefit.</li>
                        </ul>
                      </div>
                    </section>
                  </aside>
                </div>

                {couponFormError ? (
                  <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    {couponFormError}
                  </div>
                ) : null}

                <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
                  <button
                    type="button"
                    onClick={closeCouponModal}
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={createCouponMutation.isPending || updateCouponMutation.isPending} className="min-w-[220px] rounded-full bg-gym-600 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-gym-200 transition-all hover:bg-gym-700 hover:shadow-xl active:scale-[0.98]">
                    {editingItem ? 'Save Changes' : 'Create Coupon'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ), portalRoot) : null}

        {/* Post Modal */}
        {isPostModalOpen && portalRoot ? createPortal((
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="post-modal-title"
              className="relative w-full max-w-[1160px] max-h-[92vh] overflow-hidden rounded-[2rem] bg-white shadow-2xl animate-in zoom-in-95"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-white px-8 py-6">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Campaign Builder</p>
                  <h3 id="post-modal-title" className="mt-1 font-extrabold text-slate-900 text-2xl">{editingItem ? 'Edit Marketing Post' : 'New Marketing Post'}</h3>
                </div>
                <button type="button" aria-label="Close post modal" onClick={closePostModal} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50"><XCircle size={22} /></button>
              </div>
              <form noValidate className="max-h-[calc(92vh-88px)] overflow-y-auto px-8 py-8" onSubmit={submitPostForm}>
                <div className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
                  <div className="space-y-6">
                    <section className="space-y-5 rounded-[1.75rem] border border-slate-100 bg-slate-50/80 p-6">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Campaign Copy</p>
                        <h4 className="mt-1 text-lg font-bold text-slate-900">Write the post customers will see</h4>
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="post-title" className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><FileText size={12} /> Post Title</label>
                        <input id="post-title" name="title" value={postForm.title} onChange={(event) => updatePostForm('title', event.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" placeholder="Summer Mega Sale!" />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="post-content" className="text-xs font-bold text-slate-500 uppercase">Content</label>
                        <textarea id="post-content" name="content" value={postForm.content} onChange={(event) => updatePostForm('content', event.target.value)} rows="5" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" placeholder="Get 10% off all supplements this summer..." />
                      </div>
                    </section>

                    <section className="space-y-5 rounded-[1.75rem] border border-slate-100 bg-white p-6">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Banner Image</p>
                        <h4 className="mt-1 text-lg font-bold text-slate-900">Upload the campaign banner</h4>
                        <p className="mt-2 text-sm text-slate-500">Admins should upload a banner file here. The system stores the public URL internally after upload.</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><ImageIcon size={12} /> Banner Asset</label>
                        <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gym-600 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-gym-700">
                              <Upload size={16} />
                              {effectivePostBannerPreview ? 'Replace banner' : 'Upload banner'}
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="hidden"
                                onChange={handlePostBannerUpload}
                              />
                            </label>
                            {effectivePostBannerPreview ? (
                              <button
                                type="button"
                                onClick={removePostBanner}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 size={16} />
                                Remove
                              </button>
                            ) : null}
                            <span className="text-xs text-slate-500">JPG, PNG, or WEBP. Max 5 MB.</span>
                          </div>
                          {isUploadingPostBanner ? (
                            <p className="mt-3 text-sm font-medium text-gym-700">Uploading banner...</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-slate-100">
                        {effectivePostBannerPreview ? (
                          <img src={effectivePostBannerPreview} alt="Banner preview" className="h-52 w-full object-cover" />
                        ) : (
                          <div className="flex h-52 items-center justify-center text-sm text-slate-400">
                            Banner preview appears here after you upload an image.
                          </div>
                        )}
                      </div>
                    </section>
                  </div>

                  <aside className="space-y-6 xl:sticky xl:top-0 xl:self-start">
                    <section className="space-y-5 rounded-[1.75rem] border border-gym-100 bg-gym-50 p-6">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-gym-700">Link To Coupon</p>
                        <h4 className="mt-1 text-lg font-bold text-slate-900">Pick one coupon that is not already posted</h4>
                        <p className="mt-2 text-sm text-slate-500">Only active coupons are listed here. Already-linked coupons are hidden to keep the campaign list clean.</p>
                      </div>
                      <div className="space-y-3">
                        <label htmlFor="post-coupon-search" className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Ticket size={12} /> Coupon search</label>
                        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 focus-within:border-gym-500">
                          <Search size={16} className="text-slate-400" />
                          <input
                            id="post-coupon-search"
                            type="text"
                            value={postCouponSearch}
                            onChange={(event) => {
                              setPostCouponSearch(event.target.value)
                              setIsPostCouponPickerOpen(true)
                            }}
                            onFocus={() => setIsPostCouponPickerOpen(true)}
                            className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                            placeholder="Search by code, target, or benefit..."
                          />
                        </div>
                      </div>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsPostCouponPickerOpen((prev) => !prev)}
                          className={`flex w-full items-center justify-between rounded-[1.25rem] border px-4 py-4 text-left transition-all ${selectedPostCoupon ? 'border-gym-200 bg-white shadow-sm' : 'border-slate-200 bg-white'}`}
                        >
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Selected coupon</p>
                            {selectedPostCoupon ? (
                              <>
                                <p className="mt-1 font-mono text-base font-bold text-slate-900">{selectedPostCoupon.PromoCode}</p>
                                <p className="mt-1 text-sm text-slate-500">{formatCouponBenefit(selectedPostCoupon).replace(/^(ORDER|MEMBERSHIP):\s*/, '')}</p>
                              </>
                            ) : (
                              <p className="mt-1 text-sm font-semibold text-slate-500">Choose a coupon from the filtered list</p>
                            )}
                          </div>
                          <ChevronDown size={18} className={`text-slate-400 transition-transform ${isPostCouponPickerOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isPostCouponPickerOpen ? (
                          <div className="absolute z-20 mt-3 w-full overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-2xl">
                            <div className="max-h-72 overflow-y-auto p-2">
                              {availablePostCoupons.length === 0 ? (
                                <div className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                                  No unposted coupons match this search.
                                </div>
                              ) : availablePostCoupons.map((coupon) => (
                                <button
                                  key={coupon.PromotionID}
                                  type="button"
                                  onClick={() => handlePostCouponSelect(coupon)}
                                  className={`flex w-full items-start justify-between gap-3 rounded-xl px-4 py-3 text-left transition-all ${String(postForm.promotionId) === String(coupon.PromotionID) ? 'bg-gym-50 text-gym-900' : 'hover:bg-slate-50'}`}
                                >
                                  <div className="min-w-0">
                                    <p className="font-mono text-sm font-bold text-slate-900">{coupon.PromoCode}</p>
                                    <p className="mt-1 text-xs text-slate-500">{formatCouponBenefit(coupon)}</p>
                                    <p className="mt-1 text-[11px] text-slate-400">Coupon window: {new Date(coupon.ValidFrom).toLocaleDateString()} - {new Date(coupon.ValidTo).toLocaleDateString()}</p>
                                  </div>
                                  {String(postForm.promotionId) === String(coupon.PromotionID) ? <Check size={16} className="mt-1 shrink-0 text-gym-600" /> : null}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="rounded-[1.4rem] border border-white/60 bg-white/80 p-4 text-sm text-slate-600">
                        {selectedPostCoupon ? (
                          <>
                            <p className="font-bold text-slate-900">Auto-filled from coupon</p>
                            <p className="mt-1">Start and end dates below are synced to the selected coupon validity window so the campaign does not outlive the coupon.</p>
                          </>
                        ) : (
                          <p>Select a coupon first to auto-fill the campaign dates and target summary.</p>
                        )}
                      </div>
                    </section>

                    <section className="space-y-5 rounded-[1.75rem] border border-slate-100 bg-slate-50 p-6">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Schedule & Status</p>
                        <h4 className="mt-1 text-lg font-bold text-slate-900">Confirm when the post goes live</h4>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                        <div className="space-y-1">
                          <label htmlFor="post-start-at" className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Calendar size={12} /> Start At</label>
                          <input id="post-start-at" name="startAt" type="date" value={postForm.startAt} onChange={(event) => updatePostForm('startAt', event.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="post-end-at" className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Calendar size={12} /> End At</label>
                          <input id="post-end-at" name="endAt" type="date" value={postForm.endAt} onChange={(event) => updatePostForm('endAt', event.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => updatePostForm('isActive', !postForm.isActive)}
                        className={`flex w-full items-center justify-between gap-4 rounded-[1.25rem] border px-4 py-4 text-left transition-all ${postForm.isActive ? 'border-gym-200 bg-gym-50' : 'border-slate-200 bg-white'}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${postForm.isActive ? 'bg-gym-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                            <ShieldCheck size={18} />
                          </span>
                          <div>
                            <p className="text-sm font-bold text-slate-900">Set as active</p>
                            <p className="text-xs text-slate-500">{postForm.isActive ? 'Customers will see this campaign immediately when the dates are valid.' : 'Keep this post drafted until you are ready to publish it.'}</p>
                          </div>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${postForm.isActive ? 'bg-gym-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {postForm.isActive ? 'Active' : 'Draft'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updatePostForm('isImportant', !postForm.isImportant)}
                        aria-pressed={postForm.isImportant}
                        className={`flex w-full items-center justify-between gap-4 rounded-[1.25rem] border px-4 py-4 text-left transition-all ${postForm.isImportant ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${postForm.isImportant ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                            <ShieldCheck size={18} />
                          </span>
                          <div>
                            <p className="text-sm font-bold text-slate-900">Mark as important broadcast</p>
                            <p className="text-xs text-slate-500">
                              {postForm.isImportant
                                ? 'This post will notify every active customer when it is published while still appearing on the Promotions page.'
                                : 'Leave this off for normal marketing posts that should stay visible only on the Promotions page.'}
                            </p>
                          </div>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${postForm.isImportant ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {postForm.isImportant ? 'Broadcast all customers' : 'Page only'}
                        </span>
                      </button>
                      <div className="rounded-[1.4rem] border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
                        <p className="font-bold">Notification discipline</p>
                        <p className="mt-1 text-xs text-amber-800">
                          Important posts should be reserved for urgent or high-value campaigns. Standard posts stay in the Promotions page without sending a notification blast.
                        </p>
                      </div>
                    </section>
                  </aside>
                </div>
                {postFormError ? (
                  <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    {postFormError}
                  </div>
                ) : null}
                <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
                  <button type="button" onClick={closePostModal} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={createPostMutation.isPending || updatePostMutation.isPending} className="min-w-[220px] rounded-full bg-gym-600 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-gym-200 transition-all hover:bg-gym-700 hover:shadow-xl active:scale-[0.98]">
                    {editingItem ? 'Update Post' : 'Publish Post'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ), portalRoot) : null}

        <ConfirmDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmLabel="Deactivate"
          pending={deleteCouponMutation.isPending || deletePostMutation.isPending}
          onCancel={closeDeactivateDialog}
          onConfirm={confirmDeactivateDialog}
        />
      </div>
    </WorkspaceScaffold>
  )
}

export default AdminPromotionsPage
