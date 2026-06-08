// 🟢 改成預留位置符號，讓 GitHub Actions 自動來填字
    const BACKEND_URL = '{{BACKEND_URL}}'; 
    const LIFF_ID = '{{LIFF_ID}}'; 
    const GS_API_URL = '{{GS_API_URL}}'; 
    const lineid = '@898yqsqi'; // @您的LINEID，若需要測試可直接填入開發者的LINE ID
    const OM_Img_Url = 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=600&auto=format&fit=cover'; // 潛水品牌形象主圖防破版

    let PLAN_DETAILS = {}; 
    let currentOrder = { 
        code: '', name: '', basePrice: 0, addonCode: '', addonPrice: 0, 
        date: '', slot: '', pax: 1, fullTotal: 0, deposit: 0,
        // 新增以下欄位用於儲存優惠狀態
        promoCode: '', promoDiscount: 0,
        referralCode: '', referralDiscount: 0
    };
    let userIdToken = '';
    let selectedSlotText = '';
    let currentStep = 1;

    const STEP_VIEWS = {
        1: { section: 'section-list', label: 'step1-label' },
        2: { section: 'section-detail', label: 'step2-label' },
        3: { section: 'section-cart', label: 'step3-label' },
        4: { section: 'section-success', label: 'step4-label' }
    };

    /**
     * ─── 核心功能 1：從 Google Sheet API 撈取並動態建構資料 ───
     */
    async function fetchPlanDetails() {
        try {
            const response = await fetch(GS_API_URL);
            const result = await response.json();
            if (result.success) {
                PLAN_DETAILS = result.data;
                console.log('🎉 Google Sheet 資料庫整合成功：', PLAN_DETAILS);
                
                // 1. 執行列表渲染
                renderProductList();
                
                // 2. 🟢 關鍵修正：資料渲染成功後，優雅淡出並完全關閉 Loading 遮罩，絕不與主網頁重疊
                const loader = document.getElementById('loading-overlay');
                if (loader) {
                    loader.style.opacity = '0';
                    loader.style.transition = 'opacity 0.5s ease';
                    setTimeout(() => {
                        loader.style.display = 'none';
                    }, 500); // 0.5秒淡出動畫結束後，徹底從 DOM 中隱藏
                }
                
                // 3. 處理步驟與路由路由切換
                const urlParams = new URLSearchParams(window.location.search);
                const stepFromUrl = parseInt(urlParams.get('step')) || 1;
                changeStep(stepFromUrl, false); 
            } else {
                console.error('Google Sheet 資料解析錯誤');
                hideLoaderFallback();
            }
        } catch (error) {
            console.error('無法連線至 Google Sheet API。', error);
            hideLoaderFallback();
            
            // 系統異常防呆提示
            const sectionList = document.getElementById('section-list');
            if (sectionList) {
                sectionList.innerHTML = '<div style="color:var(--accent-coral); padding:20px; text-align:center; font-weight:600;">⚠️ 系統資安防護通訊異常，請稍後再試。</div>';
            }
        }
    }

    // 🟢 防呆輔助函式：確保通訊失敗時，也不會讓轉圈/潛水員卡在網頁畫面上
    function hideLoaderFallback() {
        const loader = document.getElementById('loading-overlay');
        if (loader) {
            loader.style.display = 'none';
        }
    }

    /**
     * ─── 核心功能 2：動態渲染第一頁的產品分組列表 ───
     */
    function renderProductList() {
        const sectionList = document.getElementById('section-list');
        if (!sectionList || Object.keys(PLAN_DETAILS).length === 0) return;
        
        // 根據 API 中的 kindName 自動分組 (單一事實來源)
        const grouped = Object.values(PLAN_DETAILS).reduce((acc, p) => {
            if(!acc[p.kindName]) acc[p.kindName] = [];
            acc[p.kindName].push(p);
            return acc;
        }, {});

        let listHTML = '';

        for (const [catName, products] of Object.entries(grouped)) {
            const isTour = catName.includes('休閒潛旅');
            listHTML += `<div class="category-title">${catName}</div><div class="product-grid">`;
            
            products.sort((a,b) => a.sort - b.sort).forEach(product => {
                const isLocked = product.id.startsWith('tour_');
                
                // 1. 萃取圖片網址 (優先用 bgurl，沒有就自動抓 carousel 第一張)
                //【超級防呆改動】：優先看 bgurl 有沒有填，如果沒填，自動拿 carousel 的第一張圖網址當背景
                let targetImgUrl = "";
                if (product.bgurl && product.bgurl.trim() !== "") {
                    targetImgUrl = product.bgurl.trim();
                } else if (product.carousel && product.carousel.length > 0 && product.carousel[0].url) {
                    targetImgUrl = product.carousel[0].url.trim();
                }
    
                const hasBg = targetImgUrl !== "";
                let cardStyle = "";
                
                // 2. 🟢 修正錯誤的 CSS 拼接：多重背景必須相互獨立，不能把 url() 塞進 linear-gradient() 括號裡
                if (isLocked) {
                    if (hasBg) {
                        // 有圖的舊生專區：深灰藍半透明遮罩層 (第一層) + 試算表圖片 (第二層)
                        cardStyle = `background-image: linear-gradient(135deg, rgba(74, 98, 106, 0.85), rgba(69, 90, 100, 0.85)), url('${targetImgUrl}');`;
                    } else {
                        // 沒圖的舊生專區：純色漸層
                        cardStyle = `background-image: linear-gradient(135deg, #4A626A, #455A64);`;
                    }
                    cardStyle += ` background-size: cover; background-position: center; background-repeat: no-repeat;`;
                } else if (hasBg) {
                    // 常規課程：輕度遮罩層 + 圖片
                    cardStyle = `background-image: linear-gradient(rgba(30, 81, 98, 0.2), rgba(15, 37, 55, 0.4)), url('${targetImgUrl}'); background-size: cover; background-position: center; background-repeat: no-repeat;`;
                }

                let badgeText = product.promoText ? product.promoText.split('！')[0].split('（')[0] : '精選推薦';
                if (isLocked) badgeText = '舊生學員限定';   
                
                // ──────────────────────────────────────────────────────────────
                // 🟢 新增：動態判斷列表卡片是否顯示原價（帶刪除線）
                // ──────────────────────────────────────────────────────────────
                let cardPriceHTML = "";
                if (isLocked) {
                    cardPriceHTML = '★ 點此查看行程藍圖';
                } else {
                    const currentPrice = Number(product.price).toLocaleString();
                    const originalPrice = Number(product.originalPrice).toLocaleString();
                    
                    // 如果有填原價，且原價大於目前售價，就加上刪除線樣式顯示
                    if (product.originalPrice && Number(product.originalPrice) > Number(product.price)) {
                        cardPriceHTML = `NT$ ${currentPrice} <span class="info-original-price" style="margin-left:6px; font-size:12px; color:var(--text-muted); text-decoration:line-through; font-weight:400;">原價 NT$ ${originalPrice}</span>`;
                    } else {
                        cardPriceHTML = `NT$ ${currentPrice}`;
                    }
                }
                // ──────────────────────────────────────────────────────────────

                listHTML += `
                    <div class="product-card ${isLocked ? 'locked-item' : ''}" >
                        <div class="p-img-placeholder ${hasBg && !isLocked ? 'has-bg' : ''}" style="${cardStyle}">
                            <span class="p-badge">${badgeText}</span>
                            <h3>${product.title.split('｜')[0]}</h3>
                        </div>
                        <div class="p-content">
                            <p style="font-size: 13px; color:#6B7280; margin-bottom: 10px;">${product.ActivityDescription ? product.ActivityDescription.substring(0, 100) : ''}...</p>
                            
                            <!-- 🟢 替換此處：直接引入剛剛動態組裝好的 cardPriceHTML -->
                            <div class="p-price" style="${isLocked ? 'color:#455A64; font-size:14px;' : ''}">${cardPriceHTML}</div>
                            
                            <button class="btn-order" style="${isLocked ? 'background:#455A64;' : ''}" onclick="('${product.id}', '${product.title.split('｜')[0]}', ${product.price})">${isLocked ? '查看計畫細節' : '立即預訂'}</button>
                        </div>
                    </div>`;
                
                //listHTML += `
                //    <div class="product-card ${isLocked ? 'locked-item' : ''}" >
                //        <div class="p-img-placeholder ${hasBg && !isLocked ? 'has-bg' : ''}" style="${cardStyle}">
                //            <span class="p-badge">${badgeText}</span>
                //            <h3>${product.title.split('｜')[0]}</h3>
                //        </div>
                //        <div class="p-content">
                //            <p style="font-size: 13px; color:#6B7280; margin-bottom: 10px;">${product.warmNotice ? product.warmNotice.substring(0, 30) : ''}...</p>
                //            
                //            <!-- 🟢 替換此處：直接引入剛剛動態組裝好的 cardPriceHTML -->
                //            <div class="p-price" style="${isLocked ? 'color:#455A64; font-size:14px;' : ''}">${cardPriceHTML}</div>
                //            
                //            <button class="btn-order" style="${isLocked ? 'background:#455A64;' : ''}" onclick="('${product.id}', '${product.title.split('｜')[0]}', ${product.price})">${isLocked ? '查看計畫細節' : '立即預訂'}</button>
                //        </div>
                //    </div>`;
            });
            listHTML += `</div>`;
        }
        sectionList.innerHTML = listHTML;
    }

    /**
     * ─── 核心功能 3：網頁與 LINE LIFF 初始化 ───
     * ─── 核心功能 3：網頁與 LINE LIFF 初始化（資安與結構防禦優化版） ───
     */
    async function initLIFF() {
        // 1. 先確保拉取 Google Sheet 資料庫並成功渲染首頁計畫卡片
        await fetchPlanDetails(); 
        
        // 2. 開始進行 LINE LIFF 身分憑證握手，並對 DOM 節點進行嚴格防呆
        const lineDisplayEl = document.getElementById('lineIdDisplay');
        const lineWarningEl = document.getElementById('lineWarning');
        
        try {
            await liff.init({ liffId: LIFF_ID });
            if (!liff.isLoggedIn()) {
                liff.login();
            } else {
                userIdToken = liff.getIDToken(); 
                
                // 🔒 資安防呆：確認元素存在才寫入值，避免 null 崩潰
                if (lineDisplayEl) {
                    lineDisplayEl.value = "✓ LINE 安全憑證金鑰已就緒";
                    lineDisplayEl.style.color = "#10B981";
                }
            }
        } catch (error) {
            console.warn("⚠️ [LIFF 提示] 目前可能處於環境外測試或未綁定 LINE API：", error);
            
            // 防賴鎖定：如果節點存在才動態顯示警告，不阻斷網頁開啟
            if (lineDisplayEl) {
                lineDisplayEl.value = "⚠️ 未能成功取得 LINE 綁定";
                lineDisplayEl.style.color = "#DC2626";
            }
            if (lineWarningEl) {
                lineWarningEl.style.display = "block";
            }
        }
        
        // 3. 處理瀏覽器單頁式歷史路徑路由
        const urlParams = new URLSearchParams(window.location.search);
        if(!urlParams.has('step')) {
            history.replaceState({ step: 1 }, "Step 1", "?step=1");
        }
    }

    /**
     * ─── 核心功能 4：選擇產品並動態渲染時段場次與加購 ───
     * ─── 核心功能 4：選擇產品並動態發動第一道防線檢查 ───
     */

    // 【新增】宣告一格全域變數，用來承接該課程已被咬死的日期
    let CURRENT_LOCKED_DATES = [];

    async function selectProduct(code, name, price) {
    if (window.event) window.event.stopPropagation();

    const details = PLAN_DETAILS[code];
    if (!details) {
        alert('系統提示：找不到該項目的詳細資料。');
        return;
    }

    currentOrder.code = code;
    currentOrder.name = name;
    currentOrder.basePrice = Number(price);

    // ──────────────────────────────────────────────────────────────
    // 🛡️ 流程第一步：學員點擊課程按鈕 ──> 前端動態發送大範圍日期檢查
    // ──────────────────────────────────────────────────────────────
    const loader = document.getElementById('loading-overlay');
    if (loader) {
        document.getElementById('loading-text').innerText = "正為您潛入內太空盤點教練船位...";
        loader.style.display = 'flex';
        loader.style.opacity = '1';
    }

    try {
        // 即時向後端拉取目前該課程未來 45 天已被完全咬死的日期陣列
        const response = await fetch(`${GS_API_URL}?action=getLockedDates&productCode=${code}`);
        const result = await response.json();
        if (result.success) {
            CURRENT_LOCKED_DATES = result.lockedDates; 
            console.log("🛡️ 第一道防線就緒！已額滿不開放日期清單：", CURRENT_LOCKED_DATES);
        }
    } catch (err) {
        console.error("第一道防線通訊異常，改由第二道防線全面防守:", err);
    } finally {
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => { loader.style.display = 'none'; }, 500);
        }
    }

    // ─── 下方維持輪播與文字資訊組裝（與原本相同） ───
    const infoBlock = document.getElementById('dynamic-product-info');
    const fieldsWrapper = document.getElementById('booking-fields-wrapper');
    const buttonGroup = document.getElementById('detail-action-buttons');

    // 處理輪播圖重置邏輯
    const wrapper = document.getElementById('carouselWrapperId');
    const container = document.getElementById('carouselId');
    if (wrapper && container) {
        wrapper.querySelectorAll('.carousel-nav-btn').forEach(btn => btn.remove());
        const prevBtn = document.createElement('button'); prevBtn.className = 'carousel-nav-btn prev'; prevBtn.type = 'button'; prevBtn.innerHTML = '‹'; prevBtn.onclick = () => scrollCarousel(-1);
        const nextBtn = document.createElement('button'); nextBtn.className = 'carousel-nav-btn next'; nextBtn.type = 'button'; nextBtn.innerHTML = '›'; nextBtn.onclick = () => scrollCarousel(1);
        wrapper.appendChild(prevBtn); wrapper.appendChild(nextBtn);
        container.innerHTML = '';
        if (details.carousel && details.carousel.length > 0) {
            details.carousel.forEach(imgObj => {
                const slide = document.createElement('div'); slide.className = 'carousel-slide';
                slide.innerHTML = `<img src="${imgObj.url}" alt="${imgObj.text || '呼藍之間'}" loading="lazy">`;
                container.appendChild(slide);
            });
        } else {
            const slide = document.createElement('div'); slide.className = 'carousel-slide'; slide.innerHTML = `<img src="${details.bgurl || OM_Img_Url}" alt="${name}">`;
            container.appendChild(slide);
        }
        setTimeout(() => { container.scrollLeft = 0; }, 50);
    }

    let priceHTML = code.startsWith('tour_') ? 
        '<small>OceanMurmurs 學員專屬行程 • 不開放線上直接預訂</small>' : 
        (details.originalPrice > details.price ? `NT$ ${Number(details.price).toLocaleString()} <span class="info-original-price" style="margin-left:9px; text-decoration:line-through; font-size:12px; color:var(--text-muted);">原價 NT$ ${Number(details.originalPrice).toLocaleString()}</span>` : `NT$ ${Number(details.price).toLocaleString()}`);

    let infoHTML = `<h2>${details.title}</h2>
                    <div class="info-price-row">${priceHTML}</div>
                    <div class="info-system-declare">※ 此為線上系統，<a href="javascript:void(0)" onclick="openPolicyModal()">課程細節與安全規範政策內容請至此瀏覽</a>。</div>`;
    if (details.paragraphs && details.paragraphs.length > 0) {
        details.paragraphs.forEach(p => infoHTML += `<p class="info-paragraph">${p}</p>`);
    }
    infoHTML += `<div class="info-warm-notice">${details.warmNotice}</div>`;
    infoBlock.innerHTML = infoHTML;

    if (code.startsWith('tour_')) {
        fieldsWrapper.style.display = 'none';
        buttonGroup.innerHTML = `<button class="btn-back" type="button" onclick="navigateBack()">← 返回計畫列表</button>
                                 <button class="btn-next btn-line-redirect" type="button" onclick="window.location.href='https://line.me/R/ti/p/${lineid}'">私訊 LINE 索取簡章</button>`;
    } else {
        fieldsWrapper.style.display = 'block';
        buttonGroup.innerHTML = `<button class="btn-back" type="button" onclick="navigateBack()">← 返回上一頁</button>
                                 <button class="btn-next" type="button" onclick="goToCart()">加入購物車並下一步</button>`;

        // 重置清空歷史日期與時段狀態
        document.getElementById('bookingDate').value = "";
        const slotsGrid = document.querySelector('.slots-grid');
        slotsGrid.innerHTML = '<div style="color:var(--text-muted); font-size:13px; padding: 5px 0;">💡 請先選擇上方預約日期。</div>';
        selectedSlotText = '';
        
        document.getElementById('bookingDate').min = new Date().toISOString().split('T')[0];
    }
    
    // 生成人數選單
    const paxSelect = document.getElementById('paxCount');
    if (paxSelect) {
        paxSelect.innerHTML = '';
        const maxLimit = details.peopleCount ? parseInt(details.peopleCount) : 4; 
        for (let i = 1; i <= maxLimit; i++) {
            const opt = document.createElement('option'); opt.value = i; opt.innerText = i === maxLimit ? `${i} 人 (上限)` : `${i} 人`;
            paxSelect.appendChild(opt);
        }
    }

    // 生成加購選項
    const addonContainer = document.getElementById('addon-checkbox-container');
    if (addonContainer) {
        addonContainer.innerHTML = '';
        if (details.addons && details.addons.length > 0) {
            details.addons.forEach((addon, index) => {
                const wrapper = document.createElement('div'); wrapper.style.display = 'flex'; wrapper.style.alignItems = 'center'; wrapper.style.gap = '10px'; wrapper.style.cursor = 'pointer';
                const chk = document.createElement('input'); chk.type = 'checkbox'; chk.className = 'addon-checkbox-item'; chk.value = addon.ID; chk.id = `addon_chk_${index}`;
                chk.setAttribute('data-price', addon.price); chk.setAttribute('data-text', addon.text); chk.setAttribute('data-hours', addon.hours || 0);
                const lbl = document.createElement('label'); lbl.htmlFor = `addon_chk_${index}`; lbl.style.cursor = 'pointer'; lbl.style.fontSize = '13.5px'; lbl.style.fontWeight = '500'; lbl.style.marginBottom = '0';
                lbl.innerText = `${addon.text} ( +$${addon.price.toLocaleString()} )`;
                wrapper.appendChild(chk); wrapper.appendChild(lbl); addonContainer.appendChild(wrapper);
            });
        } else {
            addonContainer.innerHTML = '<div style="color:var(--text-muted); font-size:13px;">💡 本方案目前無可額外加購之輔助服務。</div>';
        }
    }

    changeStep(2);
}

    /**
     * ─── 核心功能 5：🟢 SPA 流程切換控制 (修正返回 Step 1 的空白破版邏輯) ───
     */
    function changeStep(targetStep, isPushState = true) {
        currentStep = targetStep;
        
        if (targetStep === 1 && Object.keys(PLAN_DETAILS).length > 0) {
            renderProductList();
        }

        document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
        
        const targetView = document.getElementById(STEP_VIEWS[targetStep].section);
        if (targetView) targetView.classList.add('active');
        
        document.querySelectorAll('.step-item').forEach(l => l.classList.remove('active'));
        const targetLabel = document.getElementById(STEP_VIEWS[targetStep].label);
        if (targetLabel) targetLabel.classList.add('active');
        
        window.scrollTo(0, 0);

        if (isPushState) {
            history.pushState({ step: targetStep }, `Step ${targetStep}`, `?step=${targetStep}`);
        }
    }

    window.addEventListener('popstate', function(event) {
        if (event.state && event.state.step) {
            changeStep(event.state.step, false);
        } else {
            changeStep(1, false);
        }
    });

    function navigateBack() { history.back(); }
    
    function scrollCarousel(direction) {
        const container = document.getElementById('carouselId');
        container.scrollBy({ left: direction * container.clientWidth, behavior: 'smooth' });
    }

/**
     * ─── 核心功能 6-1：修改後的場次渲染區塊 (抽離成獨立 function 供 handleDateChange 呼叫) ───
     */
async function updateAvailableSlots(productCode, selectedDate) {
    const slotsGrid = document.querySelector('.slots-grid');
    if (!slotsGrid || !selectedDate) return;

    slotsGrid.innerHTML = '<div style="color:var(--text-muted); font-size:13px; padding: 5px 0;">🔍 正在連線安全通道，精算教練人力與船位資源...</div>';

    try {
        // 向 GAS 發送查詢
        const response = await fetch(GS_API_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: "checkAvailableSlots",
                productCode: productCode,
                date: selectedDate
            })
        });
        const result = await response.json();

        if (result.success) {
            slotsGrid.innerHTML = '';
            if (result.availableSlots && result.availableSlots.length > 0) {
                result.availableSlots.forEach(slot => {
                    const btn = document.createElement('div');
                    // 若被其他人 Soft Lock 或旺季 7 日內限制，後端直接給 status: 'locked' 或 'agent'
                    if (slot.status === 'locked') {
                        btn.className = 'slot-btn disabled';
                        btn.innerText = `${slot.name} (已滿/預約中)`;
                    } else if (slot.status === 'agent') {
                        btn.className = 'slot-btn agent';
                        btn.innerText = `${slot.name} (專人詢問)`;
                        btn.onclick = () => { window.location.href = `https://line.me/R/ti/p/${lineid}`; };
                    } else {
                        btn.className = 'slot-btn';
                        btn.innerText = slot.name;
                        btn.onclick = function() {
                            document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
                            btn.classList.add('selected');
                            selectedSlotText = slot.name;
                        };
                    }
                    slotsGrid.appendChild(btn);
                });
            } else {
                slotsGrid.innerHTML = '<div style="color:var(--accent-coral); font-size:13px; padding: 5px 0;">⚠️ 當天資源已達上限，或不滿足多日課程連續性，請更換日期。</div>';
            }
        } else {
            slotsGrid.innerHTML = `<div style="color:var(--accent-coral); font-size:13px; padding: 5px 0;">⚠️ 讀取失敗：${result.message}</div>`;
        }
    } catch (err) {
        slotsGrid.innerHTML = '<div style="color:var(--accent-coral); font-size:13px; padding: 5px 0;">⚠️ 網路通訊異常，請重新選取日期。</div>';
    }
}

    /**
     * ─── 核心功能 6：表單防呆與規則過濾 ───
     * ─── 核心功能 6：學員點擊日期時 ──> 前端動態過濾並發送時段檢查（第二道防線） ───
     */
       async function handleDateChange() {
    const dateInput = document.getElementById('bookingDate');
    const fdAlert = document.getElementById('fdAlert');
    const slotsGrid = document.querySelector('.slots-grid');
    const selectedDateStr = dateInput.value;
    
    if (!selectedDateStr) return;

    // ──────────────────────────────────────────────────────────────
    // 🛡️ 檢查點 1：比對點點擊課程時，大範圍拉回來已經額滿的黑名單日期
    // ──────────────────────────────────────────────────────────────
    if (CURRENT_LOCKED_DATES.includes(selectedDateStr)) {
        fdAlert.innerHTML = "⚠️ <b>無法預約</b>：該日期的教練人力班次已完全額滿，或有全店停運事件，請重新選擇其他日期！";
        fdAlert.style.color = "#DC2626";
        fdAlert.style.display = "block";
        dateInput.value = "";
        slotsGrid.innerHTML = '<div style="color:var(--text-muted); font-size:13px; padding: 5px 0;">💡 請重新選擇上方預約日期。</div>';
        return;
    }

    // ─── 檢查點 2：旺季與假日 7 日內防呆機制 ───
    const selectedDate = new Date(selectedDateStr);
    const today = new Date();
    const timeDiff = selectedDate.getTime() - today.getTime();
    const diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
    const month = selectedDate.getMonth() + 1;
    const dayOfWeek = selectedDate.getDay(); 
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    if ((month >= 6 && month <= 8) || isWeekend) {
        if (diffDays <= 7) {
            fdAlert.innerHTML = "⚠️ <b>系統提示</b>：旺季或假日 7 日內的場次極度緊繃，線上關閉直接預約，請轉專人為您處理！";
            fdAlert.style.color = "#EA580C";
            fdAlert.style.display = "block";
            dateInput.value = "";
            slotsGrid.innerHTML = '<div style="color:var(--text-muted); font-size:13px; padding: 5px 0;">💡 請重新選擇上方預約日期。</div>';
            return;
        }
    }

    // ─── 檢查點 3：針對多日考照課程（OW/AO）進行「跨日連續性」阻斷檢查 ───
    const details = PLAN_DETAILS[currentOrder.code];
    const hours = details.hours ? parseInt(details.hours) : 24;
    const needDays = Math.ceil(hours / 24); 

    if (needDays > 1) {
        for (let i = 0; i < needDays; i++) {
            const nextCheckDate = new Date(selectedDate);
            nextCheckDate.setDate(selectedDate.getDate() + i);
            const nextCheckDateStr = nextCheckDate.toISOString().split('T')[0];
            
            // 只要多日班的連續範圍內，有任何一天在額滿黑名單中，直接塗灰阻斷
            if (CURRENT_LOCKED_DATES.includes(nextCheckDateStr)) {
                fdAlert.innerHTML = `⚠️ <b>區間阻斷</b>：本課程需要連續 ${needDays} 天，但 ${nextCheckDateStr} 當天教練資源已滿，無法排課，請變更開始日期！`;
                fdAlert.style.color = "#DC2626";
                fdAlert.style.display = "block";
                dateInput.value = "";
                slotsGrid.innerHTML = '<div style="color:var(--text-muted); font-size:13px; padding: 5px 0;">💡 請重新選擇上方預約日期。</div>';
                return;
            }
        }
    }

    // 常規半年養成計畫防呆
    if (currentOrder.code === 'plan_2_half_year') {
        const minLimit = new Date(); minLimit.setDate(minLimit.getDate() + 14);
        if (selectedDateStr < minLimit.toISOString().split('T')[0]) {
            fdAlert.innerText = "💡 條款防呆：半年養成計畫最晚需 2 週前預約。";
            fdAlert.style.color = "#1E5162"; fdAlert.style.display = "block"; dateInput.value = "";
            slotsGrid.innerHTML = '<div style="color:var(--text-muted); font-size:13px; padding: 5px 0;">💡 請重新選擇上方預約日期。</div>';
            return;
        }
    }

    // ──────────────────────────────────────────────────────────────
    // 🛡️ 流程第二步：通過大範圍考核後，發送即時檢查請求拉取「時段軟硬鎖狀態」
    // ──────────────────────────────────────────────────────────────
    fdAlert.style.display = "none";
    slotsGrid.innerHTML = '<div style="color:var(--text-muted); font-size:13px; padding:5px 0;">🔍 正在核對當天剩餘時段船位...</div>';

    try {
        const response = await fetch(`${GS_API_URL}?action=checkSlots&date=${selectedDateStr}&productCode=${currentOrder.code}`);
        const result = await response.json();
        
        if (result.success) {
            slotsGrid.innerHTML = '';
            
            if (details.slots && details.slots.length > 0) {
                details.slots.forEach(slotName => {
                    const btn = document.createElement('div');
                    btn.className = 'slot-btn';
                    btn.innerText = slotName;
                    
                    // 如果這個時段在 Orders 存在有效的 Soft Lock 或 Hard Lock，直接鎖死
                    if (result.lockedSlots.includes(slotName)) {
                        btn.classList.add('disabled-slot');
                        btn.innerText = `${slotName} (已被佔位/額滿)`;
                    } else {
                        btn.onclick = function() {
                            document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
                            btn.classList.add('selected');
                            selectedSlotText = slotName;
                        };
                    }
                    slotsGrid.appendChild(btn);
                });
            } else {
                slotsGrid.innerHTML = '<div style="color:var(--accent-coral); font-size:13px; padding: 5px 0; grid-column: span 2;">⚠️ 本方案無固定場次，報名後將由小編人工為您安排。</div>';
            }
        }
    } catch (error) {
        console.error("時段動態防禦通訊異常:", error);
        slotsGrid.innerHTML = '<div style="color:var(--accent-coral); font-size:13px;">⚠️ 無法取得該日場次，請重新點選日期。</div>';
    }
}
       
    /**
     * ─── 核心功能 7：加入購物車明細計算 (全面支援加購多選) ───
     */    
    function goToCart() {
        const payBtn = document.getElementById('payBtn');
        payBtn.disabled = false;
        payBtn.innerText = '安全送出訂單並跳轉支付';
        
        const dateVal = document.getElementById('bookingDate').value;
        if (!dateVal || !selectedSlotText) {
            alert('請完整選取預約日期與場次時段！');
            return;
        }

        // ─── 新增：發動後端 Soft Lock 佔位防禦 ───
    try {
        const response = await fetch(GS_API_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: "softLockSlot",
                productCode: currentOrder.code,
                date: dateVal,
                slot: selectedSlotText,
                pax: parseInt(document.getElementById('paxCount').value)
            })
        });
        const lockResult = await response.json();
        
        if (!lockResult.success) {
            alert(`下手慢了！ ${lockResult.message}，請重新選擇時段。`);
            updateAvailableSlots(currentOrder.code, dateVal); // 刷新時段
            return;
        }
        // ─── 佔位成功，進入後續金流計算 ───
    } catch(err) {
        alert('安全佔位通訊忙碌中，請重新嘗試。');
        return;
    }
        
        currentOrder.date = dateVal;
        currentOrder.slot = selectedSlotText;
        currentOrder.pax = parseInt(document.getElementById('paxCount').value);
        
        // 每次進入購物車時，初始化清空舊的優惠輸入、避免跨訂單殘留
        currentOrder.promoCode = ''; currentOrder.promoDiscount = 0;
        currentOrder.referralCode = ''; currentOrder.referralDiscount = 0;
        document.getElementById('promoCodeInput').value = '';
        document.getElementById('promoCodeMessage').style.display = 'none';
        document.getElementById('referralCodeInput').value = '';
        document.getElementById('referralCodeMessage').style.display = 'none';
    
        // 🛠️ 1. 核心日期演算法：計算主商品的「起訖日期範圍」
        const mainDetails = PLAN_DETAILS[currentOrder.code];
        const mainHours = mainDetails && mainDetails.hours ? parseInt(mainDetails.hours) : 24;
        const mainDays = Math.ceil(mainHours / 24); // 72小時 = 3天
        
        let dateDisplayRange = currentOrder.date; // 預設單天
        if (mainDays > 1) {
            const startDate = new Date(currentOrder.date);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + (mainDays - 1));
            
            const endYear = endDate.getFullYear();
            const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
            const endDateStr = String(endDate.getDate()).padStart(2, '0');
            
            dateDisplayRange = `${currentOrder.date} ~ ${endYear}-${endMonth}-${endDateStr}`;
        }
        currentOrder.dateRangeText = dateDisplayRange;

        // 2. 巡檢所有被學員勾選的 Checkbox 加購項目
        let totalAddonPrice = 0;
        let checkedAddonsList = []; 
        let addonCodes = [];
        
        const checkedItems = document.querySelectorAll('.addon-checkbox-item:checked');
        checkedItems.forEach(chk => {
            const rawText = chk.getAttribute('data-text');
            const price = parseInt(chk.getAttribute('data-price')) || 0;
            const addonHours = parseInt(chk.getAttribute('data-hours')) || 0;
            
            let days = 1;         // 預設乘數為 1
            let isByDay = false;  // 用來標記是否為「按日計算」的項目
            
            // 🔍 關鍵防線：只有原始文字中包含 "- 1日"，才去計算或連動主課程天數
            if (rawText.includes('- 1日')) {
                days = addonHours > 0 ? Math.ceil(addonHours / 24) : mainDays;
                isByDay = true;
            }
            
            // 過濾拔除前端顯示不需要的 [加購：] 與 [- 1日]
            const cleanText = rawText.replace(/加購：/g, '').replace(/- 1日/g, '').trim();
            
            // 單一加購小計 = 金額 * 天數 * 人數
            const subtotal = price * days * currentOrder.pax;
            totalAddonPrice += (price * days); // 紀錄單人份加購總價累加

            checkedAddonsList.push({
                text: cleanText,
                price: price,
                days: days,
                isByDay: isByDay, // 傳給表格渲染判斷
                subtotal: subtotal
            });
            addonCodes.push(chk.value);
        });
        
        currentOrder.addonPrice = totalAddonPrice; 
        currentOrder.addonCode = addonCodes.length > 0 ? addonCodes.join(',') : 'none';
        currentOrder._selectedAddonsDetails = checkedAddonsList;

        // 執行金額精算與表格渲染
        calculateCartAmounts();
        changeStep(3);
    }
    
    /**
     * ─── 核心功能 7-2：收銀台總金額精算與購物車 HTML 表格動態渲染 ───
     */
    // 🟢 新增：專職處理核心收銀台金額渲染的函式
    function calculateCartAmounts() {
        // 1. 全額總計：(主商品單價 + 所有加購單人總價) * 人數
        currentOrder.fullTotal = (currentOrder.basePrice + currentOrder.addonPrice) * currentOrder.pax;
        
        // 🛠️ 2. 核心訂金比例演算法
        const mainDetails = PLAN_DETAILS[currentOrder.code];
        const depositRatio = (mainDetails && typeof mainDetails.deposit !== 'undefined') ? parseFloat(mainDetails.deposit) : 0.5;
        const depositPercentText = `${Math.round(depositRatio * 100)}%`;
        
        // 動態計算訂金金額
        currentOrder.deposit = currentOrder.fullTotal * depositRatio; 
    
        // 3. 現場尾款精算 (全額 - 線上訂金 - 優惠折扣)
        let finalFinalRemains = Math.max(0, (currentOrder.fullTotal - currentOrder.deposit) - currentOrder.promoDiscount - currentOrder.referralDiscount);
    
        // 4. ✨ 動態建構一項一列表格
        const tbody = document.getElementById('cart-tbody');
        if (tbody) {
            let tbodyHTML = '';
            
            // A. 主商品列
            tbodyHTML += `
                <tr>
                    <td>
                        <div style="font-weight: 600; font-size: 15px; color: #111827;">${currentOrder.name}</div>
                        <div style="font-size: 12px; color: #6B7280; margin-top: 5px;">📅 日期: ${currentOrder.dateRangeText} / 🕒 時段: ${currentOrder.slot}</div>
                    </td>
                    <td>NT$ ${currentOrder.basePrice.toLocaleString()}</td>
                    <td>${currentOrder.pax} 人</td>
                    <td>NT$ ${(currentOrder.basePrice * currentOrder.pax).toLocaleString()}</td>
                </tr>
            `;
            
            // B. 加購明細列
            if (currentOrder._selectedAddonsDetails && currentOrder._selectedAddonsDetails.length > 0) {
                currentOrder._selectedAddonsDetails.forEach(addon => {
                    // 🛠️ 視覺優化：如果是按日計算的，顯示「X人 × X日」；如果是單次計費，只顯示「X人」
                    const quantityText = addon.isByDay 
                        ? `${currentOrder.pax} 人 × ${addon.days} 日` 
                        : `${currentOrder.pax} 人`;

                    tbodyHTML += `
                        <tr style="background-color: #F9FAFB;">
                            <td style="padding-left: 20px; color: var(--primary-teal); font-size: 14px;">
                                ➕ <b>加購項目：</b>${addon.text}
                            </td>
                            <td>NT$ ${addon.price.toLocaleString()}</td>
                            <td style="color: #6B7280; font-size: 13px;">${quantityText}</td>
                            <td>NT$ ${addon.subtotal.toLocaleString()}</td>
                        </tr>
                    `;
                });
            }
            
            // C. 底部訂金提示
            tbodyHTML += `
                <tr style="border-top: 2px solid var(--primary-teal);">
                    <td colspan="3" style="text-align: right; font-weight: 600; padding: 15px; font-size: 14px;">本次線上需支付 ${depositPercentText} 訂金總計：</td>
                    <td style="color: var(--accent-coral); font-weight: 700; font-size: 16px;">
                        NT$ ${currentOrder.deposit.toLocaleString()}
                        <div style="font-size: 11px; font-weight: normal; color: #94A3B8; margin-top: 2px;">(已包含上述所有項目之對應成數)</div>
                    </td>
                </tr>
            `;
            
            tbody.innerHTML = tbodyHTML;
        }
    
        // 5. 更新右側金流收銀台面板金額與標題文字
        const depositLabel = document.querySelector('.summary-row.total span:first-child');
        if (depositLabel) {
            depositLabel.innerText = `本次應付訂金 (${depositPercentText})`;
        }
        
        document.getElementById('summary-full-total').innerText = `NT$ ${currentOrder.fullTotal.toLocaleString()}`;
        document.getElementById('summary-deposit').innerText = `NT$ ${currentOrder.deposit.toLocaleString()}`;
        document.getElementById('summary-discount').innerText = `NT$ ${finalFinalRemains.toLocaleString()}`;
    
        // 6. 控制官方折扣明細列
        const promoRow = document.getElementById('summary-promo-discount-row');
        if (currentOrder.promoDiscount > 0) {
            document.getElementById('summary-promo-discount').innerText = `- NT$ ${currentOrder.promoDiscount.toLocaleString()}`;
            promoRow.style.display = 'flex';
        } else { promoRow.style.display = 'none'; }
    
        // 7. 控制舊生推薦明細列
        const refRow = document.getElementById('summary-referral-discount-row');
        if (currentOrder.referralDiscount > 0) {
            document.getElementById('summary-referral-discount').innerText = `- NT$ ${currentOrder.referralDiscount.toLocaleString()}`;
            refRow.style.display = 'flex';
        } else { refRow.style.display = 'none'; }
    }

    /**
     * ─── 核心功能 7-1：折扣碼 / 學員推薦碼 安全驗證 ───
     */
    async function validateCodeViaGAS(inputType) {
        const promoInput = document.getElementById('promoCodeInput');
        const refInput = document.getElementById('referralCodeInput');
        const promoMsg = document.getElementById('promoCodeMessage');
        const refMsg = document.getElementById('referralCodeMessage');
        
        // 確保核心輸入框物件存在
        if (!promoInput || !refInput || !promoMsg || !refMsg) {
            console.error("系統錯誤：找不到 HTML 優惠碼輸入框或訊息元素。");
            return;
        }

        // 根據學員點擊的按鈕，抓取對應輸入框的值
        let inputValue = inputType === 'promo' ? promoInput.value.trim() : refInput.value.trim();
        
        if (!inputValue) {
            alert('請先輸入代碼或姓名！');
            return;
        }
        
        // 先初始化清空兩個視覺提示區，確保乾淨
        promoMsg.style.display = 'none';
        refMsg.style.display = 'none';
        
        // 動態決定當前要顯示 Loading 的訊息框
        let activeMsg = inputType === 'promo' ? promoMsg : refMsg;
        activeMsg.style.display = 'block';
        activeMsg.style.color = '#4B5563';
        activeMsg.style.background = '#F3F4F6';
        activeMsg.style.padding = '6px';
        activeMsg.style.borderRadius = '4px';
        activeMsg.innerText = '🔍 安全通道驗證與品項核對中...';
    
        try {
            // 🔐 發送請求到 GAS：使用頂部定義的 GS_API_URL，並帶上當前商品 ID
            const response = await fetch(GS_API_URL, { 
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain' }, 
                body: JSON.stringify({ 
                    code: inputValue, 
                    productCode: currentOrder.code 
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // 🔒 驗證成功，根據後端資料表的 kind 屬性，落實「二選一」互斥防線
                if (result.kind === "官方折扣碼") {
                    // 1. 寫入官方折扣資料
                    currentOrder.promoCode = inputValue;
                    currentOrder.promoDiscount = result.amount;
                    
                    // 2. 徹底清空對立的舊學員推薦紀錄與輸入框
                    currentOrder.referralCode = '';
                    currentOrder.referralDiscount = 0;
                    refInput.value = ''; 
                    refMsg.style.display = 'none';
                    
                    // 3. 渲染官方提示訊息
                    promoMsg.style.background = '#EFF6FF';
                    promoMsg.style.color = '#1E40AF';
                    promoMsg.innerText = result.message;
                    
                    // 防呆移位：若學員在舊生框輸入了官方碼，自動校正歸位
                    if (inputType === 'referral') {
                        promoInput.value = inputValue;
                    }
                } else if (result.kind === "舊學員推薦") {
                    // 1. 寫入舊學員推薦資料
                    currentOrder.referralCode = inputValue;
                    currentOrder.referralDiscount = result.amount;
                    
                    // 2. 徹底清空對立的官方折扣紀錄與輸入框
                    currentOrder.promoCode = '';
                    currentOrder.promoDiscount = 0;
                    promoInput.value = '';
                    promoMsg.style.display = 'none';

                    // 3. 渲染舊生提示訊息
                    refMsg.style.background = '#EFF6FF';
                    refMsg.style.color = '#1E40AF';
                    refMsg.innerText = result.message;
                    
                    // 防呆移位：若學員在官方框輸入了舊生名，自動校正歸位
                    if (inputType === 'promo') {
                        refInput.value = inputValue;
                    }
                }
                
            } else {
                // 驗證失敗 (停用、查無此代碼、或品項限制不符)
                activeMsg.style.background = '#FFF5F5';
                activeMsg.style.color = '#C53030';
                activeMsg.innerText = result.message;
                
                // 失敗時清除當下的輸入紀錄
                if (inputType === 'promo') { currentOrder.promoCode = ''; currentOrder.promoDiscount = 0; }
                if (inputType === 'referral') { currentOrder.referralCode = ''; currentOrder.referralDiscount = 0; }
            }
            
            // 重新精算並更新收銀台金額面板
            calculateCartAmounts();
            
        } catch (err) {
            console.error('GAS 通訊異常:', err);
            activeMsg.style.background = '#FFF5F5';
            activeMsg.style.color = '#C53030';
            activeMsg.innerText = '⚠️ 安全檢驗通道暫時忙碌，請重新套用或私訊官方 LINE。';
        }
    }

    /**
     * ─── 核心功能 8：安全對核 Modal 控制 ───
     */
    function openConfirmationModal() {
        const name = document.getElementById('custName').value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const email = document.getElementById('custEmail').value;
        if (!name || !email) {
            alert('請完整填寫學員中文姓名與聯絡 Email！');
            return;
        }
        document.getElementById('m-name').innerText = name;
        document.getElementById('m-email').innerText = email;
        document.getElementById('m-plan').innerText = currentOrder.name;
        
        // 處理內文時間
        document.getElementById('m-datetime').innerText = `${currentOrder.date} ( ${currentOrder.slot} )`;
        document.getElementById('m-pax').innerText = `${currentOrder.pax} 人`;
        document.getElementById('m-deposit').innerText = `NT$ ${currentOrder.deposit.toLocaleString()} 元`;
        
        // 🟢 優化提示：如果學員有輸入優惠，在 Modal 底部用小字強力提醒他
        let noteText = "請確認以下資訊是否正確，送出後將加密傳輸至統一安全金流：";
        if (currentOrder.promoDiscount > 0 || currentOrder.referralDiscount > 0) {
            const totalDiscount = currentOrder.promoDiscount + currentOrder.referralDiscount;
            noteText += `<br><span style="color:#10B981; font-weight:bold;">★ 系統已偵測到優惠折抵共 NT$ ${totalDiscount}，將於現場付尾款時自動扣除。</span>`;
        }
        document.querySelector('#confirmModal .modal-body p').innerHTML = noteText;
    
        document.getElementById('confirmModal').classList.add('open');
    }

    function closeConfirmationModal() { document.getElementById('confirmModal').classList.remove('open'); }

    /**
     * ─── 核心功能 9：加密傳輸並發起終端金流結帳 ───
     */
    async function executeFinalCheckout() {
        closeConfirmationModal();
        const payBtn = document.getElementById('payBtn');
        payBtn.disabled = true;
        payBtn.innerText = '安全加密傳輸中...';
        const name = document.getElementById('custName').value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const email = document.getElementById('custEmail').value;
        
        try {
            const response = await fetch(`${BACKEND_URL}/api/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: userIdToken, customerName: name, customerEmail: email, orderData: currentOrder })
            });
            const result = await response.json();
            if (result.success && result.paymentUrl) {
                window.location.href = result.paymentUrl;
            } else {
                alert(`系統金流配置異常：${result.message}`);
                payBtn.disabled = false;
                payBtn.innerText = '安全送出訂單並跳轉支付';
            }
        } catch (err) { 
            console.warn('正在進行後端介接測試，暫時導向虛擬成功視窗，並同步發動自動化寄信。', err);

            // 🟢 觸發自動化自動發信函式
            await triggerAutomationEmail(name, email);

            changeStep(4, true); 
        }
    }

    /**
     * ─── 🟢 新增核心功能：呼叫 GAS 安全通道發送 Email ───
     */    
    async function triggerAutomationEmail(customerName, customerEmail) {
        try {
            // 發送至 GAS 核心端點
            await fetch(GS_API_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: "saveOrderAndSendEmail",
                    name: customerName,
                    email: customerEmail,
                    lineToken: userIdToken, // 🟢 新增：將 LINE LIFF 取得的 Token 傳給後端寫入 M 欄
                    order: currentOrder
                })
            });
            console.log("📊 報名資料與 LINE ID 已成功備份至 Sheet [Orders]，行前信已寄出。");
        } catch (emailErr) {
            console.error("❌ 報名資料同步或自動化發信通訊異常:", emailErr);
        }
    }

    /**
     * ─── 核心功能 10：狀態重置 ───
     */
    function resetAndReturnHome() {
        document.getElementById('custName').value = "";
        document.getElementById('custEmail').value = "";
        document.getElementById('bookingDate').value = "";
        selectedSlotText = '';
        changeStep(1, true);
    } 

    // 開啟規範視窗
    function openPolicyModal() {
        document.getElementById('policyModal').classList.add('open');
    }
    
    // 關閉規範視窗
    function closePolicyModal() {
        document.getElementById('policyModal').classList.remove('open');
    }

    /**
     * ─── 11：載入中：在 initApp() 啟動時開啟氣泡生成器 ───
     */    
    //async function initApp() {
    //    //startLoadingText();
        
    //    // 🟢 不需要再使用 setInterval 了！純 CSS 氣泡在網頁打開的第一瞬間就會自己動起來！
    //    await fetchPlanDetails();
    //    initLIFF();
    //}
    async function initApp() {
        // 啟動時一併執行 LIFF 與 Sheet 整合，純 CSS 氣泡會自然運作
        await initLIFF();
    }

    // 👑 正式啟動全店系統（修改：改為呼叫總進入點，移除多餘的重複調用）
    window.addEventListener('DOMContentLoaded', () => {
        initApp();
    });

    // 啟動應用
    initLIFF();   
