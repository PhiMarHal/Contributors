
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

async function updatePage(pageNumber) {
    startLoadingAnimation();
    try {
        pageNumber = Math.max(0, Math.min(pageNumber, totalPages));

        let pageContent = cachedPages[pageNumber];
        if (!pageContent) {
            pageContent = await readOnlyContract.pageScript(pageNumber);
            cachedPages[pageNumber] = pageContent;
        }

        // Add 512 blank spaces to the end of the content
        pageContent = pageContent + ' ' + '\u00A0'.repeat(512);

        document.getElementById('storyContent').textContent = pageContent;
        currentPage = pageNumber;
        document.getElementById('pageNumber').textContent = `PAGE ${pageNumber}`;

        document.getElementById('firstPage').style.opacity = (pageNumber === 0) ? '0.5' : '1';
        document.getElementById('prevPage').style.opacity = (pageNumber === 0) ? '0.5' : '1';
        document.getElementById('nextPage').style.opacity = (pageNumber >= totalPages) ? '0.5' : '1';
        document.getElementById('lastPage').style.opacity = (pageNumber >= totalPages) ? '0.5' : '1';
    } catch (error) {
        handleError("fetch page", error);
    } finally {
        stopLoadingAnimation();
    }
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

        // Fetch the contribution cost
        const costInWei = await readOnlyContract.next_contribution_cost();
        contributionCost = ethers.utils.formatEther(costInWei);

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

        // Update UI based on current connection status (moved outside if/else)
        updateWalletStatus();


        await fetchCurrentPage();
        setupContributionPopup();
        setupJumpToPagePopup();
        setupEventListener();
    } catch (error) {
        handleError("initialize app", error);
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
        const newPageContent = await readOnlyContract.pageScript(pageNumber);
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
        const newCostInWei = await readOnlyContract.next_contribution_cost();
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

            // Wait for the network to finish switching
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Reinitialize the contract with the new network
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = web3Provider.getSigner();
            contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONFIG.CONTRACT_ABI, signer);

            return true;
        } catch (switchError) {
            if (switchError.code === 4902) {
                showCustomAlert("This network is not available in your MetaMask, please add it manually.");
            } else {
                handleError("switch networks", error);
            }
            return false;
        }
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

