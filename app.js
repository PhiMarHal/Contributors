
let contract;
let readOnlyContract;
let currentPage = 0;
let totalPages = 0;
let cachedPages = {};
let loadingAnimationInterval;
let userAddress = null;
let registeredName = null;
let contributionCost = "0.0002"; // Default value
let eventListener;
let jumpToPagePopup;
let jumpToPageInput;
let jumpToPageButton;
let cachedBalance = 0;

const ANIMATION_SPEED = 10; // ms between each step
const HIGHLIGHT_COLOR = '#8A2BE2'; // Purple
const HIGHLIGHT_WIDTH = 64; // Number of runes to highlight at once

let isAnimating = false;
let animationFrame = null;

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);

    const moonIcon = document.querySelector('#darkModeToggle .moon-icon');
    const sunIcon = document.querySelector('#darkModeToggle .sun-icon');

    if (isDarkMode) {
        moonIcon.style.display = 'none';
        sunIcon.style.display = 'inline';
    } else {
        moonIcon.style.display = 'inline';
        sunIcon.style.display = 'none';
    }

    //updateSVGColors();
}

function applyDarkMode() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        document.querySelector('#darkModeToggle .moon-icon').style.display = 'none';
        document.querySelector('#darkModeToggle .sun-icon').style.display = 'inline';
    } else {
        document.querySelector('#darkModeToggle .moon-icon').style.display = 'inline';
        document.querySelector('#darkModeToggle .sun-icon').style.display = 'none';
    }
    //updateSVGColors();
}

async function loadNewsContent() {
    try {
        const response = await fetch('news.json');
        const data = await response.json();
        return data.news;
    } catch (error) {
        console.error('Error loading news:', error);
        return [];
    }
}

async function displayNewsContent() {
    const newsContent = await loadNewsContent();
    const storyContent = document.getElementById('storyContent');

    if (newsContent.length === 0) {
        storyContent.innerHTML = '<p>No news available at this time.</p>';
        return;
    }

    let newsHtml = '<h2 style="text-align:center;">NEWS</h2>';
    newsContent.forEach(item => {
        newsHtml += `
            <div class="news-item">
                <h3>${item.title}</h3>
                <p class="news-date">${item.date}</p>
                <p>${item.content}</p>
            </div>
        `;
    });

    storyContent.innerHTML = newsHtml;
    storyContent.classList.add('news-content');
}

function toggleNewsContent(e) {
    e.preventDefault();
    const storyContent = document.getElementById('storyContent');

    if (storyContent.classList.contains('news-content')) {
        // Restore the original content
        storyContent.textContent = cachedPages[currentPage] + ' ' + '\u00A0'.repeat(512);
        storyContent.classList.remove('news-content');
    } else {
        // Show news content
        displayNewsContent();
    }
}

async function addScrollNetwork() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: '0x82750', // 534352 in decimal
                    chainName: 'Scroll',
                    nativeCurrency: {
                        name: 'Ethereum',
                        symbol: 'ETH',
                        decimals: 18
                    },
                    rpcUrls: ['https://rpc.scroll.io'],
                    blockExplorerUrls: ['https://scrollscan.com/']
                }]
            });
            console.log('Scroll network has been added to the wallet!');
            return true;
        } catch (error) {
            console.error('Failed to add Scroll network:', error);
            return false;
        }
    } else {
        console.error('MetaMask is not installed');
        return false;
    }
}

function startLoadingAnimation() {
    if (isAnimating) return; // Don't start a new animation if one is already running

    const leftRunes = document.querySelectorAll('#leftRunes .rune');
    const rightRunes = document.querySelectorAll('#rightRunes .rune');

    if (leftRunes.length === 0 || rightRunes.length === 0) {
        console.log("Runes not found, skipping animation");
        return;
    }

    const allRunes = [...leftRunes, ...rightRunes];
    let currentIndex = 0;
    let lastAnimationTime = 0;

    isAnimating = true;

    function animateRunes(currentTime) {
        if (!isAnimating) {
            return;  // Stop the animation if isAnimating is false
        }

        if (currentTime - lastAnimationTime > ANIMATION_SPEED) {
            // Reset all runes
            allRunes.forEach(rune => rune.style.fill = '');

            // Highlight the current group of runes
            for (let i = 0; i < HIGHLIGHT_WIDTH; i++) {
                const leftIndex = (currentIndex + i) % leftRunes.length;
                const rightIndex = (currentIndex + i) % rightRunes.length;
                leftRunes[leftIndex].style.fill = HIGHLIGHT_COLOR;
                rightRunes[rightIndex].style.fill = HIGHLIGHT_COLOR;
            }

            currentIndex = (currentIndex + 1) % leftRunes.length;
            lastAnimationTime = currentTime;
        }

        animationFrame = requestAnimationFrame(animateRunes);
    }

    animationFrame = requestAnimationFrame(animateRunes);
}

function stopLoadingAnimation() {
    isAnimating = false;

    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }

    // Reset rune colors immediately
    const allRunes = document.querySelectorAll('.rune');
    allRunes.forEach(rune => {
        rune.style.fill = '';
    });
}

// Add this function to check if a page is published
async function isPagePublished(pageNumber) {
    try {
        const pageScript = await readOnlyContract.page(pageNumber);
        return pageScript.script !== "";
    } catch (error) {
        console.error("Error checking page publication status:", error);
        return false;
    }
}

async function updateBalance() {
    if (userAddress) {
        try {
            const balanceWei = await readOnlyContract.etherBalance(userAddress);
            cachedBalance = parseFloat(ethers.utils.formatEther(balanceWei));
        } catch (error) {
            console.error("Failed to fetch balance:", error);
            cachedBalance = 0;
        }
    }
}

// Modify the openContributionPopup function
async function openContributionPopup() {
    clearAlert();
    const contributionPopup = document.getElementById('contributionPopup');
    const altContributionPopup = document.getElementById('altContributionPopup');
    const altContributionMessage = document.getElementById('altContributionMessage');
    const goToCurrentPageButton = document.getElementById('goToCurrentPageButton');

    if (currentPage == totalPages) {
        contributionPopup.style.display = 'flex';
        altContributionPopup.style.display = 'none';
    } else {
        altContributionPopup.style.display = 'flex';
        contributionPopup.style.display = 'none';

        // Show loading message and start animation
        altContributionMessage.innerHTML = "<p>...</p>";
        startLoadingAnimation();

        const isPublished = await isPagePublished(currentPage);

        if (isPublished) {
            altContributionMessage.innerHTML = "<p>To contribute, go to the current page</p>";
            goToCurrentPageButton.textContent = "GO";
            goToCurrentPageButton.onclick = goToCurrentPage;
        } else {
            altContributionMessage.innerHTML = "<p>To edit this page, post your draft on the Discord channel</p>";
            goToCurrentPageButton.textContent = "GO TO DISCORD";
            goToCurrentPageButton.onclick = () => window.open(CONFIG.DISCORD_URL, "_blank");
        }

        // Stop loading animation
        stopLoadingAnimation();
    }
}

function goToCurrentPage() {
    updatePage(totalPages);
    document.getElementById('altContributionPopup').style.display = 'none';
}

function handleError(action, error) {
    console.error(`Failed to ${action}:`, error);

    let userMessage = `Failed to ${action}: `;
    if (error.message) {
        // Extract the part of the message before the first parenthesis or bracket
        const match = error.message.match(/^(.*?)[\(\[]/);
        userMessage += match ? match[1].trim() : error.message.trim();
    } else {
        userMessage += 'An unexpected error occurred';
    }

    showCustomAlert(userMessage);
}

async function fetchCurrentPage() {
    try {
        startLoadingAnimation();
        const newTotalPages = await readOnlyContract.currentPage();
        totalPages = newTotalPages;
        await updatePageContent(totalPages);

        // Add this line to update the display to the current page
        await updatePage(totalPages);
    } catch (error) {
        handleError("fetch current page", error);
    } finally {
        stopLoadingAnimation();
    }
}

function cleanup() {
    if (eventListener) {
        eventListener.removeAllListeners();
    }
}

function filterText(text) {
    const filters = {
        'cock': 'chicken',
        'badword2': 'goodword2',
        // Add more word pairs as needed
    };

    return text.replace(/\b(?:cock|badword2)\b/gi, matched => filters[matched.toLowerCase()]);
}

async function updatePage(pageNumber) {
    startLoadingAnimation();
    try {
        pageNumber = Math.max(0, Math.min(pageNumber, totalPages));

        const storyContent = document.getElementById('storyContent');
        let displayedContent = ' ' + '\u00A0'.repeat(192);

        // Check if we have a cached page, unless we're on the current page
        if (cachedPages[pageNumber] && cachedPages[pageNumber].content && !ethers.BigNumber.from(pageNumber).eq(totalPages)) {
            storyContent.innerHTML = cachedPages[pageNumber].content;
        } else {
            const pageInfo = await readOnlyContract.page(pageNumber);
            if (pageInfo.script === '') {
                // Page is not finished, fetch individual contributions
                const contributions = await fetchContributions(pageNumber);

                // Clear existing content
                storyContent.innerHTML = displayedContent;

                // Add contributions
                contributions.forEach((contribution, index) => {
                    const span = document.createElement('span');
                    span.textContent = contribution.text + (index < contributions.length - 1 ? ' ' : '');
                    span.className = 'contribution';
                    span.dataset.author = contribution.author;
                    span.dataset.authorName = contribution.authorName;
                    span.dataset.number = contribution.number;
                    storyContent.appendChild(span);
                });

                // Add final spaces
                storyContent.innerHTML += ' ' + '\u00A0'.repeat(384);

                // Cache the content
                cachedPages[pageNumber] = { content: storyContent.innerHTML };

                // Set up event listeners for contributions
                setupContributionInteractions();
            } else {
                // Page is finished, display as before
                displayedContent += filterText(pageInfo.script) + ' ' + '\u00A0'.repeat(384);
                storyContent.textContent = displayedContent;
                // Cache the content
                cachedPages[pageNumber] = { content: storyContent.innerHTML };
            }
        }

        currentPage = pageNumber;
        document.getElementById('pageNumber').textContent = `PAGE ${pageNumber}`;

        updateNavigationButtons(pageNumber);
    } catch (error) {
        handleError("fetch page", error);
    } finally {
        stopLoadingAnimation();
    }
}


function updateNavigationButtons(pageNumber) {
    document.getElementById('firstPage').style.opacity = (pageNumber === 0) ? '0.5' : '1';
    document.getElementById('prevPage').style.opacity = (pageNumber === 0) ? '0.5' : '1';
    document.getElementById('nextPage').style.opacity = (pageNumber >= totalPages) ? '0.5' : '1';
    document.getElementById('lastPage').style.opacity = (pageNumber >= totalPages) ? '0.5' : '1';
}

async function fetchContributions(pageNumber) {
    const contributionsPerPage = 16;
    const startIndex = pageNumber * contributionsPerPage;
    const endIndex = startIndex + contributionsPerPage;

    // Check if we have cached contributions for this page
    if (cachedPages[pageNumber] && cachedPages[pageNumber].contributions) {
        return cachedPages[pageNumber].contributions;
    }

    const contributionPromises = [];
    const authorPromises = [];

    for (let i = startIndex; i < endIndex; i++) {
        contributionPromises.push(readOnlyContract.contribution(i));
        authorPromises.push(readOnlyContract.addressToName(readOnlyContract.contribution(i).then(c => c.author)));
    }

    const [contributionResults, authorResults] = await Promise.all([
        Promise.all(contributionPromises),
        Promise.all(authorPromises)
    ]);

    const contributions = contributionResults.map((contribution, index) => ({
        text: filterText(contribution.script),
        author: contribution.author,
        authorName: authorResults[index] || formatAddress(contribution.author),
        number: index + 1
    }));

    // Cache the contributions for this page
    if (!cachedPages[pageNumber]) {
        cachedPages[pageNumber] = {};
    }
    cachedPages[pageNumber].contributions = contributions;

    return contributions;
}

function formatAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function setupContributionInteractions() {
    const contributions = document.querySelectorAll('.contribution');
    contributions.forEach(contribution => {
        contribution.addEventListener('mouseover', showAuthorTooltip);
        contribution.addEventListener('mouseout', hideAuthorTooltip);
        contribution.addEventListener('touchstart', showAuthorTooltip);
        contribution.addEventListener('touchend', hideAuthorTooltip);
    });
}

function showAuthorTooltip(event) {
    const contribution = event.target;
    const authorName = contribution.dataset.authorName;
    const contributionNumber = contribution.dataset.number;
    console.log("Showing tooltip for author:", authorName, "contribution:", contributionNumber);

    const tooltip = document.getElementById('authorTooltip');
    const tooltipText = tooltip.querySelector('text');
    const tooltipRect = tooltip.querySelector('rect');

    tooltipText.textContent = `${authorName} (${contributionNumber}/16)`;

    // Update tooltip size based on text content
    const bbox = tooltipText.getBBox();
    tooltipRect.setAttribute('width', bbox.width + 10);
    tooltipRect.setAttribute('height', bbox.height + 10);

    // Position the tooltip near the mouse cursor
    const svg = document.querySelector('svg');
    const svgRect = svg.getBoundingClientRect();
    const svgX = event.clientX - svgRect.left;
    const svgY = event.clientY - svgRect.top;

    // Ensure the tooltip doesn't go off the edges of the SVG
    const tooltipX = Math.max(5, Math.min(svgX + 10, 600 - bbox.width - 15));
    const tooltipY = Math.max(5, Math.min(svgY - 30, 900 - bbox.height - 15));

    tooltip.setAttribute('transform', `translate(${tooltipX}, ${tooltipY})`);
    tooltip.style.display = 'block';

    // Highlight the text
    contribution.style.color = 'var(--highlight-color)';
}

function hideAuthorTooltip(event) {
    const tooltip = document.getElementById('authorTooltip');
    tooltip.style.display = 'none';

    // Remove highlight
    event.target.style.color = '';
}

function loadEthers() {
    return new Promise((resolve, reject) => {
        if (typeof ethers !== 'undefined') {
            resolve();
        } else {
            const script = document.createElement('script');
            script.src = 'https://cdn.ethers.io/lib/ethers-5.7.2.umd.min.js';
            script.onload = resolve;
            script.onerror = () => {
                console.log('CDN load failed, trying local fallback');
                const localScript = document.createElement('script');
                localScript.src = 'ethers-5.7.2.umd.min.js'; // Local fallback
                localScript.onload = resolve;
                localScript.onerror = reject;
                document.body.appendChild(localScript);
            };
            document.body.appendChild(script);
        }
    });
}

async function initializeApp() {
    initializeRunes();
    try {
        await loadEthers();
        // Always set up the read-only contract
        const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
        readOnlyContract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONFIG.CONTRACT_ABI, provider);

        // Check if a web3 wallet is detected
        if (typeof window.ethereum !== 'undefined') {
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = web3Provider.getSigner();
            contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONFIG.CONTRACT_ABI, signer);

            // Listen for account changes
            window.ethereum.on('accountsChanged', handleAccountsChanged);
        } else {
            console.log("No web3 wallet detected. Read-only mode activated.");
        }

        applyDarkMode();
        document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);
        document.getElementById('newsIcon').addEventListener('click', toggleNewsContent);

        updateWalletStatus();
        await fetchCurrentPage();
        checkContributionCost();
        setupContributionPopup();
        setupJumpToPagePopup();
        setupEventListener();
    } catch (error) {
        console.error("Failed to initialize app:", error);
        showCustomAlert(`Failed to initialize app: ${error.message}`);
    } finally {
        stopLoadingAnimation();
    }
}

function setupJumpToPagePopup() {
    jumpToPagePopup = document.getElementById('jumpToPagePopup');
    jumpToPageInput = document.getElementById('jumpToPageInput');
    jumpToPageButton = document.getElementById('jumpToPageButton');

    const pageNumber = document.getElementById('pageNumber');
    pageNumber.addEventListener('click', () => {
        jumpToPagePopup.style.display = 'flex';
        jumpToPageInput.value = '';
        jumpToPageInput.focus();
    });

    jumpToPageButton.addEventListener('click', handleJumpToPage);
    jumpToPageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleJumpToPage();
        }
    });

    jumpToPagePopup.addEventListener('click', (e) => {
        if (e.target === jumpToPagePopup) {
            jumpToPagePopup.style.display = 'none';
        }
    });

    jumpToPageInput.addEventListener('input', handlePageInputChange);
}

function handlePageInputChange(event) {
    let value = parseInt(event.target.value);
    if (isNaN(value)) {
        event.target.value = '';
    } else {
        value = Math.max(0, Math.min(value, totalPages));
        event.target.value = value;
    }
}

function handleJumpToPage() {
    const pageNumber = parseInt(jumpToPageInput.value);
    if (pageNumber >= 0 && pageNumber <= totalPages) {
        updatePage(pageNumber);
        jumpToPagePopup.style.display = 'none';
    } else {
        showCustomAlert(`Valid pages lie between 0 and ${totalPages}.`);
    }
}


function setupEventListener() {
    eventListener = readOnlyContract.on("BatchMetadataUpdate", (fromTokenId, toTokenId) => {
        console.log("Metadata update detected for tokens:", fromTokenId.toString(), "to", toTokenId.toString());
        const pageNumber = Math.floor(fromTokenId / (16 * 2)); // 16 contributions per page, 2 tokens per contribution
        updatePageContent(pageNumber);
    });
}

async function updatePageContent(pageNumber) {
    try {
        startLoadingAnimation();
        newPageContent = await readOnlyContract.pageScript(pageNumber);
        newPageContent = filterText(newPageContent);
        cachedPages[pageNumber] = newPageContent;

        const newTotalPages = await readOnlyContract.currentPage();
        if (newTotalPages > totalPages) {
            totalPages = newTotalPages;

            // Check the contribution cost in the background
            checkContributionCost();
        }

        if (pageNumber === currentPage) {
            await updatePage(currentPage);
        }
    } catch (error) {
        console.error(`Failed to update page ${pageNumber}:`, error);
    } finally {
        stopLoadingAnimation();
    }
}

// Separate function to check and update the contribution cost
async function checkContributionCost() {
    try {
        const pageInfo = await readOnlyContract.page(totalPages);
        const newCostInWei = pageInfo.cost;
        const newCost = ethers.utils.formatEther(newCostInWei);
        if (newCost !== contributionCost) {
            contributionCost = newCost;
            console.log("Contribution cost updated to:", contributionCost);
        }
    } catch (error) {
        console.error("Failed to update contribution cost:", error);
    }
}

function initializeRunes() {
    const leftRunes = document.getElementById('leftRunes');
    const rightRunes = document.getElementById('rightRunes');

    if (leftRunes && rightRunes) {
        const runeText = 'ᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆᛚᚮᛁᚤᛆᛆ';
        const runeSpans = Array.from(runeText).map(rune => `<tspan class="rune">${rune}</tspan>`).join('');

        leftRunes.querySelector('textPath').innerHTML = runeSpans;
        rightRunes.querySelector('textPath').innerHTML = runeSpans;

        console.log("Runes initialized");
    } else {
        console.error("Rune containers not found in the DOM");
    }
}

async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAddress = accounts[0];

            // Check and switch to the correct network if necessary
            if (!await checkAndSwitchNetwork()) {
                // If the user didn't switch to the correct network, don't proceed
                return false;
            }

            const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = web3Provider.getSigner();
            contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONFIG.CONTRACT_ABI, signer);
            await updateRegisteredName();
            await updateBalance();
            updateWalletStatus();
            return true;
        } catch (error) {
            console.error("Failed to connect wallet:", error);
            updateWalletStatus();
            return false;
        }
    } else {
        showCustomAlert("Could not detect sign of life. Install a web3 wallet first.");
        return false;
    }
}



function disconnectWallet() {
    userAddress = null;
    registeredName = null;
    contract = null;
    updateWalletStatus();
}


async function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // User disconnected their wallet
        userAddress = null;
        registeredName = null;
    } else if (accounts[0] !== userAddress) {
        // User switched to a different account
        userAddress = accounts[0];
        await updateRegisteredName();
    }
    updateWalletStatus();
}

async function updateRegisteredName() {
    if (userAddress && contract) {
        try {
            registeredName = await contract.addressToName(userAddress);
            if (registeredName === '') {
                registeredName = null;
            }
        } catch (error) {
            console.error("Failed to fetch registered name:", error);
            registeredName = null;
        }
    } else {
        registeredName = null;
    }
}

async function updateWalletStatus() {
    const walletStatus = document.getElementById('walletStatus');
    const nameRegistration = document.getElementById('nameRegistration');
    const rewardInfo = document.getElementById('rewardInfo');
    const balanceStatus = document.getElementById('balanceStatus');
    const walletButton = document.getElementById('walletButton');
    const withdrawButton = document.getElementById('withdrawButton');

    if (!userAddress) {
        walletStatus.textContent = 'No Connected Wallet';
        nameRegistration.style.display = 'none';
        rewardInfo.style.display = 'none';
        walletButton.textContent = 'Connect';  // Changed this line
    } else {
        if (registeredName) {
            walletStatus.textContent = `Connected Wallet: ${registeredName}`;
            nameRegistration.style.display = 'none';
        } else {
            walletStatus.textContent = `Connected Wallet: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
            nameRegistration.style.display = 'flex';
        }
        walletButton.textContent = 'Disconnect';  // Changed this line

        if (userAddress) {
            if (cachedBalance > 0) {
                balanceStatus.textContent = `Balance: ${cachedBalance.toFixed(4)} ETH`;
                rewardInfo.style.display = 'flex';
                withdrawButton.style.display = 'block';
            } else {
                rewardInfo.style.display = 'none';
            }
        }
    }
}

async function checkAndSwitchNetwork() {
    const rpcNetworkId = await getRPCNetworkId();
    const userNetworkId = await getUserNetworkId();

    if (rpcNetworkId !== userNetworkId) {
        showCustomAlert(`Please switch to Scroll Mainnet. Expected network ID: ${rpcNetworkId}, Your current network ID: ${userNetworkId}.`);
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${rpcNetworkId.toString(16)}` }],
            });
        } catch (switchError) {
            if (switchError.code === 4902) {
                showCustomAlert("Scroll Mainnet missing. Attempting to add it to your wallet...");
                // This error code indicates that the chain has not been added to MetaMask
                const added = await addScrollNetwork();
                if (added) {
                    // Try switching again after adding the network
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: `0x${rpcNetworkId.toString(16)}` }],
                    });
                } else {
                    showCustomAlert("Failed to add Scroll network. Please add it manually.");
                    return false;
                }
            } else {
                handleError("switch networks", switchError);
                return false;
            }
        }

        // Wait for the network to finish switching
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Reinitialize the contract with the new network
        const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = web3Provider.getSigner();
        contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONFIG.CONTRACT_ABI, signer);

        return true;
    }
    return true;
}

async function contribute() {
    if (!checkWallet()) return;
    if (!await connectWallet()) return;

    const contribution = document.getElementById('contributionInput').value;
    if (contribution.length === 0 || contribution.length > 256) {
        showCustomAlert("Contribution must be between 1 and 256 characters.");
        return;
    }

    if (!await checkAndSwitchNetwork()) return;

    try {
        const tx = await contract.contribute(contribution, { value: ethers.utils.parseEther(contributionCost) });
        await tx.wait();
        showCustomAlert("Contribution sent successfully!");
        document.getElementById('contributionInput').value = '';
        closePopup();
        fetchCurrentPage();
    } catch (error) {
        handleError("send contribution", error);
    }
}

function validateName(name) {
    // Check if the name is empty or too long
    if (name.length === 0 || name.length > 22) {
        return false;
    }

    // Check if the name contains only alphanumeric characters, underscores, and hyphens
    const validNameRegex = /^[a-zA-Z0-9_-]+$/;
    return validNameRegex.test(name);
}

async function registerName() {
    if (!userAddress) {
        showCustomAlert("Please connect your wallet first.");
        return;
    }

    const nameInput = document.getElementById('nameInput');
    const name = nameInput.value.trim();

    if (!validateName(name)) {
        showCustomAlert("Only alphanumeric characters, underscores, and hyphens. Up to 22 characters.");
        return;
    }

    if (!await checkAndSwitchNetwork()) return;

    try {
        startLoadingAnimation();
        const tx = await contract.register(name);
        await tx.wait();
        registeredName = name;
        updateWalletStatus();
        showCustomAlert(`Rise and shine, ${name}. You are now one of us.`);
        nameInput.value = '';
    } catch (error) {
        handleError("register name", error);
    } finally {
        stopLoadingAnimation();
    }
}

function setupCharacterCounter() {
    const input = document.getElementById('contributionInput');
    const counter = document.getElementById('charCounter');

    input.addEventListener('input', function () {
        counter.textContent = `${this.value.length} / 256`;
    });
}

function setupContributionPopup() {
    setupCharacterCounter();
    const submitContributionButton = document.getElementById('submitContribution');
    const registerNameButton = document.getElementById('registerName');
    const withdrawButton = document.getElementById('withdrawButton');

    submitContributionButton.addEventListener('click', contribute);
    registerNameButton.addEventListener('click', registerName);
    withdrawButton.addEventListener('click', withdraw);

    // Close popup when clicking outside
    document.getElementById('contributionPopup').addEventListener('click', (e) => {
        if (e.target === document.getElementById('contributionPopup')) {
            closePopup();
        }
    });

    // Add event listener for altContributionPopup
    document.getElementById('altContributionPopup').addEventListener('click', (e) => {
        if (e.target === document.getElementById('altContributionPopup')) {
            closePopup();
        }
    });
}


function closePopup() {
    document.getElementById('contributionPopup').style.display = 'none';
    document.getElementById('altContributionPopup').style.display = 'none';
}

function showCustomAlert(message) {
    const alertArea = document.getElementById('alertArea');
    alertArea.textContent = message;

    setTimeout(clearAlert, 8000);
}

function clearAlert() {
    const alertArea = document.getElementById('alertArea');
    alertArea.textContent = '';
}

async function getRPCNetworkId() {
    try {
        const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
        const network = await provider.getNetwork();
        return network.chainId;
    } catch (error) {
        console.error("Failed to get RPC network ID:", error);
        return null;
    }
}

async function getUserNetworkId() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            return parseInt(chainId, 16);
        } catch (error) {
            console.error("Failed to get user's network ID:", error);
            return null;
        }
    } else {
        console.error("MetaMask is not installed");
        return null;
    }
}

function checkWallet() {
    if (typeof window.ethereum === 'undefined' || !contract) {
        showCustomAlert("Connect a web3 wallet to unlock your power.");
        return false;
    }
    return true;
}

function handleWalletButtonClick() {
    if (userAddress) {
        disconnectWallet();
    } else {
        connectWallet();
    }
}

async function withdraw() {
    if (!checkWallet()) return;
    if (!await checkAndSwitchNetwork()) return;

    try {
        const tx = await contract.withdraw();
        await tx.wait();
        showCustomAlert("Withdrawal successful!");
        await updateBalance();
        updateWalletStatus();
    } catch (error) {
        handleError("withdraw", error);
    }
}

document.addEventListener('DOMContentLoaded', (event) => {
    const helpIcon = document.getElementById('helpIcon');
    const storyContent = document.getElementById('storyContent');

    helpIcon.addEventListener('click', function (e) {
        e.preventDefault();
        if (storyContent.classList.contains('help-content')) {
            // Restore the original content
            storyContent.textContent = cachedPages[currentPage] + ' ' + '\u00A0'.repeat(512);
            storyContent.classList.remove('help-content');
        } else {
            // Show help content
            storyContent.innerHTML = `
                <p>Welcome, Contributor.</p>
                <p>In this interactive story, you decide what happens next.</p>
                <p>Here are the rules of the Infinite Scroll:
                <ol>
                    <li>One contribution may be up to 256 characters.</li>
                    <li>One page is made of 16 contributions.</li>
                    <li>Once a page is filled, a final draft will be submitted.</li>
                </ol>
                <p>Each contribution costs ${contributionCost} ETH.</p>
                <p>Each contribution mints 2 NFTs. 1 of your unique contribution, and 1 of the page you wrote it on.</p>
                <p>If you want to be an editor for a page filled with contributions, <a href="${CONFIG.DISCORD_URL}" target="_blank">join our Discord</a> and come post your draft.</p>
                <p>Need more info? Check the <a href="${CONFIG.BLOG_URL}" target="_blank">intro blog</a> or read the <a href="${CONFIG.DOCS_URL}" target="_blank">full docs</a>.</p>
                <p><a href="#" id="backToStory">Back to the Story</a></p>
            `;
            storyContent.classList.add('help-content');

            // Add event listener for "Back to the Story" link
            document.getElementById('backToStory').addEventListener('click', function (e) {
                e.preventDefault();
                storyContent.textContent = cachedPages[currentPage] + ' ' + '\u00A0'.repeat(512);
                storyContent.classList.remove('help-content');
            });
        }
    });
});

document.getElementById('firstPage').addEventListener('click', () => updatePage(0));
document.getElementById('prevPage').addEventListener('click', () => updatePage(currentPage - 1));
document.getElementById('nextPage').addEventListener('click', () => updatePage(currentPage + 1));
document.getElementById('lastPage').addEventListener('click', () => updatePage(totalPages));
document.getElementById('walletButton').addEventListener('click', handleWalletButtonClick);
document.getElementById('contributeButton').addEventListener('click', openContributionPopup);
document.getElementById('goToCurrentPageButton').addEventListener('click', goToCurrentPage);


window.addEventListener('load', initializeApp);

window.onbeforeunload = cleanup;

