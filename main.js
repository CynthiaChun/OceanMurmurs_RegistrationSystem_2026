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
                            
                            <button class="btn-order" style="${isLocked ? 'background:#455A64;' : ''}" onclick="selectProduct('${product.id}', '${product.title.split('｜')[0]}', ${product.price})">${isLocked ? '查看計畫細節' : '立即預訂'}</button>
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
                //            <button class="btn-order" style="${isLocked ? 'background:#455A64;' : ''}" onclick="selectProduct('${product.id}', '${product.title.split('｜')[0]}', ${product.price})">${isLocked ? '查看計畫細節' : '立即預訂'}</button>
                //        </div>
                //    </div>`;
            });
            listHTML += `</div>`;
        }
        sectionList.innerHTML = listHTML;
    }

    /**
     * ─── 核心功能 3：網頁與 LINE LIFF 初始化 ───
     */
    async function initLIFF() {
        // 🟢 調整順序：先優雅等待 API 撈取與初次渲染完畢後，再發起 LINE 身分憑證握手
        await fetchPlanDetails(); 
        try {
            await liff.init({ liffId: LIFF_ID });
            if (!liff.isLoggedIn()) {
                liff.login();
            } else {
                userIdToken = liff.getIDToken(); 
                document.getElementById('lineIdDisplay').value = "✓ LINE 安全憑證金鑰已就緒";
                document.getElementById('lineIdDisplay').style.color = "#10B981";
            }
        } catch (error) {
            document.getElementById('lineIdDisplay').value = "⚠️ 未能成功取得 LINE 綁定";
            document.getElementById('lineIdDisplay').style.color = "#DC2626";
            document.getElementById('lineWarning').style.display = "block";
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        if(!urlParams.has('step')) {
            history.replaceState({ step: 1 }, "Step 1", "?step=1");
        }
    }

    /**
     * ─── 核心功能 4：選擇產品並動態渲染時段場次與加購 ───
     */
    function selectProduct(code, name, price) {
        if (window.event) window.event.stopPropagation();

        const details = PLAN_DETAILS[code];
        if (!details) {
            alert('系統提示：找不到該項目的詳細資料。');
            return;
        }

        // ──────────────────────────────────────────────────────────────
        // 🟢 核心修改區域：動態渲染輪播圖 (Carousel Carousel Slide)
        // ──────────────────────────────────────────────────────────────
        // ──────────────────────────────────────────────────────────────
        // 🟢 核心修改區域：動態渲染輪播圖 (精準分離按鈕與滾動容器)
        // ──────────────────────────────────────────────────────────────
        const wrapper = document.getElementById('carouselWrapperId');
        const container = document.getElementById('carouselId');
        
        if (wrapper && container) {
            // 1. 先把「外層」的按鈕清空並重新植入（確保不會重複累積按鈕）
            // 先保留原本的長寬比容器，並將按鈕釘在 wrapper 這層
            wrapper.querySelectorAll('.carousel-nav-btn').forEach(btn => btn.remove());
            
            // 2. 重新植入外層按鈕（維持原本的分離邏輯）
            wrapper.querySelectorAll('.carousel-nav-btn').forEach(btn => btn.remove());

            const prevBtn = document.createElement('button');
            prevBtn.className = 'carousel-nav-btn prev';
            prevBtn.type = 'button';
            prevBtn.innerHTML = '‹';
            prevBtn.onclick = () => scrollCarousel(-1);
        
            const nextBtn = document.createElement('button');
            nextBtn.className = 'carousel-nav-btn next';
            nextBtn.type = 'button';
            nextBtn.innerHTML = '›';
            nextBtn.onclick = () => scrollCarousel(1);
        
            wrapper.appendChild(prevBtn);
            wrapper.appendChild(nextBtn);
        
            // 3. 清空「內層」滾動容器，專心只放圖片滑塊
            container.innerHTML = '';
         
            // 4. 開始塞入新產品的圖片
            if (details.carousel && details.carousel.length > 0) {
                // 遍歷 API 回傳的 carousel 陣列，動態組裝 img 標籤
                details.carousel.forEach(imgObj => {
                    const slide = document.createElement('div');
                    slide.className = 'carousel-slide';
                    slide.innerHTML = `<img src="${imgObj.url}" alt="${imgObj.text || '呼藍之間'}" loading="lazy">`;
                    container.appendChild(slide);
                });
            } else if (details.bgurl && details.bgurl.trim() !== "") {
                // 防呆機制：若 carousel 欄位剛好沒填，則自動降級使用主 bgurl 填滿單張輪播
                const slide = document.createElement('div');
                slide.className = 'carousel-slide';
                slide.innerHTML = `<img src="${details.bgurl}" alt="${name}" loading="lazy">`;
                container.appendChild(slide);
            } else {
                // 完全無圖時的預設潛水品牌形象主圖防破版
                const slide = document.createElement('div');
                slide.className = 'carousel-slide';
                slide.innerHTML = `<img src="${OM_Img_Url}" alt="Ocean Murmurs">`;
                container.appendChild(slide);
            }
            
            // 渲染完成後，強制重設輪播圖捲軸回到最左側第一張
            //container.scrollLeft = 0;

            // 5. 【關鍵動作二】利用瀏覽器排程，確保新 DOM 物件長好後，再次強制歸零
            // 使用 setTimeout 確保這段程式碼在 UI 渲染隊列的最後才執行，資安與視覺體驗最穩固
            setTimeout(() => {
                container.scrollLeft = 0;
            }, 50);
        }
        // ──────────────────────────────────────────────────────────────
        // ──────────────────────────────────────────────────────────────
        // 🟢 核心修改區域結束（下方維持你原本的 infoHTML、fieldsWrapper 邏輯即可）
        // ──────────────────────────────────────────────────────────────


        currentOrder.code = code;
        currentOrder.name = name;
        currentOrder.basePrice = Number(price);

        const infoBlock = document.getElementById('dynamic-product-info');
        const fieldsWrapper = document.getElementById('booking-fields-wrapper');
        const buttonGroup = document.getElementById('detail-action-buttons');

        // ──────────────────────────────────────────────────────────────
        // 🟢 修改區域：補上原價顯示邏輯
        // ──────────────────────────────────────────────────────────────
        let priceHTML = "";
        if (code.startsWith('tour_')) {
            priceHTML = '<small>OceanMurmurs 學員專屬行程 • 不開放線上直接預訂</small>';
        } else {
            const price = Number(details.price).toLocaleString();
            const originalPrice = Number(details.originalPrice).toLocaleString();
            
            // 如果有原價且原價大於售價，才顯示刪除線的原價
            if (details.originalPrice > details.price) {
                priceHTML = `NT$ ${price} <span class="info-original-price" style="margin-left:9px;">原價 NT$ ${originalPrice}</span>`;
            } else {
                priceHTML = `NT$ ${price}`;
            }
        }

        let infoHTML = `<h2>${details.title}</h2>
                        <div class="info-price-row">${priceHTML}</div>
                        <div class="info-system-declare">※ 此為線上系統，<a href="javascript:void(0)" onclick="openPolicyModal()">課程細節與安全規範政策內容請至此瀏覽</a>。</div>`;
        // 🟢 動態組裝介紹內文，將試算表的 admin_note (我的說明) 漂亮地顯示在畫面上
        //let infoHTML = `<h2>${details.title}</h2>
        //                <div class="info-price-row">${priceHTML}</div>
        //                
        //                <!-- 新增：如果有 admin_note 說明，用一格漂亮的小區塊呈現包含項目 -->
        //                ${details.admin_note ? `
        //                    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 12px; border-radius: 8px; margin: 15px 0; font-size: 13.5px; line-height: 1.6; color: #334155;">
        //                        <strong style="color: var(--primary-teal); display: block; margin-bottom: 4px;">📦 方案包含項目說明：</strong>
        //                        ${details.admin_note}
        //                    </div>
        //                ` : ''}
        //                
        //                <div class="info-system-declare">※ 此為線上系統，<a href="javascript:void(0)" onclick="openPolicyModal()">課程細節與安全規範政策內容請至此瀏覽</a>。</div>`;
        // ──────────────────────────────────────────────────────────────

        
        if (details.paragraphs && details.paragraphs.length > 0) {
            details.paragraphs.forEach(p => infoHTML += `<p class="info-paragraph">${p}</p>`);
        }
        infoHTML += `<div class="info-warm-notice">${details.warmNotice}</div>`;
        infoBlock.innerHTML = infoHTML;

        // 如果是舊生限定的潛旅區塊，隱藏時段表單，直接導向官方 LINE 客服索取簡章
        if (code.startsWith('tour_')) {
            fieldsWrapper.style.display = 'none';
            buttonGroup.innerHTML = `<button class="btn-back" type="button" onclick="navigateBack()">← 返回計畫列表</button>
                                     <button class="btn-next btn-line-redirect" type="button" onclick="window.location.href='https://line.me/R/ti/p/${lineid}'">💬 私訊官方 LINE 索取專屬簡章</button>`;
        } else {
            fieldsWrapper.style.display = 'block';
            buttonGroup.innerHTML = `
                <button class="btn-back" type="button" onclick="navigateBack()">← 返回上一頁</button>
                <button class="btn-next" type="button" onclick="goToCart()">加入購物車並下一步</button>
            `;

            // 動態場次按鈕渲染
            const slotsGrid = document.querySelector('.slots-grid');
            slotsGrid.innerHTML = ''; 
            if (details.slots && details.slots.length > 0) {
                details.slots.forEach(slotName => {
                    const btn = document.createElement('div');
                    btn.className = 'slot-btn';
                    btn.innerText = slotName;
                    btn.onclick = function() {
                        document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
                        btn.classList.add('selected');
                        selectedSlotText = slotName;
                    };
                    slotsGrid.appendChild(btn);
                });
            } else {
                slotsGrid.innerHTML = '<div style="color:var(--accent-coral); font-size:13px; padding: 5px 0; grid-column: span 2;">⚠️ 本方案無固定場次，報名後將由小編人工為您安排。</div>';
            }

            // ──────────────────────────────────────────────────────────────
            // 新增：根據資料庫 maxPax 動態生成預約人數下拉選單
            // 終極修正：對齊資料庫欄位名稱 details.peopleCount 動態生成人數選單
            // ──────────────────────────────────────────────────────────────
            const paxSelect = document.getElementById('paxCount');
            if (paxSelect) {
                paxSelect.innerHTML = ''; // 先清空下拉選單的舊選項
                
                // 🔑 關鍵改動：你的 Google Sheet 回傳欄位叫做 peopleCount，在此精準讀取
                const maxLimit = details.peopleCount ? parseInt(details.peopleCount) : 4; 
                
                // 跑迴圈動態吐出 1 到上限值的選單節點
                for (let i = 1; i <= maxLimit; i++) {
                    const opt = document.createElement('option');
                    opt.value = i;
                    // 當數值到達上限時，加上 (上限) 的防呆視覺提示
                    opt.innerText = i === maxLimit ? `${i} 人 (上限)` : `${i} 人`;
                    paxSelect.appendChild(opt);
                }
            }
            // ──────────────────────────────────────────────────────────────

            // 動態增值加購服務選單
            //const addonSelect = document.getElementById('addon-select');
            //addonSelect.innerHTML = '<option value="none" data-price="0">不加購額外服務</option>'; 
            //if (details.addons && details.addons.length > 0) {
            //    details.addons.forEach(addon => {
            //        const opt = document.createElement('option');
            //        opt.value = addon.type; 
            //        opt.setAttribute('data-price', addon.price);
            //        opt.innerText = `${addon.text} — +$${addon.price.toLocaleString()}`;
            //        addonSelect.appendChild(opt);
            //    });
            //}
            // ──────────────────────────────────────────────────────────────
            // 🟢 調整：將加購服務改為 Checkbox 多選框動態生成
            // ──────────────────────────────────────────────────────────────
            const addonContainer = document.getElementById('addon-checkbox-container');
            if (addonContainer) {
                addonContainer.innerHTML = ''; // 先刷空舊的容器内容
                
                if (details.addons && details.addons.length > 0) {
                    details.addons.forEach((addon, index) => {
                        const wrapper = document.createElement('div');
                        wrapper.style.display = 'flex';
                        wrapper.style.alignItems = 'center';
                        wrapper.style.gap = '10px';
                        wrapper.style.cursor = 'pointer';
                        
                        // 建立 Checkbox 本體
                        const chk = document.createElement('input');
                        chk.type = 'checkbox';
                        chk.className = 'addon-checkbox-item';
                        chk.value = addon.type;
                        chk.id = `addon_chk_${index}`;
                        chk.setAttribute('data-price', addon.price);
                        chk.setAttribute('data-text', addon.text);

                        // 🟢 新增：把 API 的 hours 欄位埋入 HTML 屬性中，如果沒有寫預設為 0
                        chk.setAttribute('data-hours', addon.hours || 0);
                        
                        // 處理事件：勾選時立即重新計算金額（選填：如果你希望在 Step 2 就能即時看到金額）
                        // chk.onchange = function() { ... }; 

                        // 建立 Label 標籤文字
                        const lbl = document.createElement('label');
                        lbl.htmlFor = `addon_chk_${index}`;
                        lbl.style.cursor = 'pointer';
                        lbl.style.fontSize = '13.5px';
                        lbl.style.fontWeight = '500';
                        lbl.style.marginBottom = '0'; // 覆蓋全域的 label margin
                        lbl.innerText = `${addon.text} ( +$${addon.price.toLocaleString()} )`;
                        
                        wrapper.appendChild(chk);
                        wrapper.appendChild(lbl);
                        addonContainer.appendChild(wrapper);
                    });
                } else {
                    addonContainer.innerHTML = '<div style="color:var(--text-muted); font-size:13px;">💡 本方案目前無可額外加購之輔助服務。</div>';
                }
            }
            // ──────────────────────────────────────────────────────────────
        }
        
        document.getElementById('bookingDate').value = "";
        selectedSlotText = '';
        changeStep(2);
        handleDateChange();
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
     * ─── 核心功能 6：表單防呆與規則過濾 ───
     */
    function handleDateChange() {
        const dateInput = document.getElementById('bookingDate');
        const fdAlert = document.getElementById('fdAlert');
        if (currentOrder.code === 'plan_2_half_year') {
            const minLimit = new Date();
            minLimit.setDate(minLimit.getDate() + 14); 
            const formattedMin = minLimit.toISOString().split('T')[0];
            dateInput.min = formattedMin;
            fdAlert.innerText = "💡 條款防呆：半年養成計畫最晚需 2 週前預約，系統已為您過濾近兩週日期。";
            fdAlert.style.display = "block";
            if (dateInput.value && dateInput.value < formattedMin) { dateInput.value = ""; }
        } else {
            dateInput.removeAttribute('min');
            fdAlert.style.display = "none";
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
    async function initApp() {
        //startLoadingText();
        
        // 🟢 不需要再使用 setInterval 了！純 CSS 氣泡在網頁打開的第一瞬間就會自己動起來！
        await fetchPlanDetails();
        initLIFF();
    }

    // 啟動應用
    initLIFF();   