
let contract;
let readOnlyContract;
let currentPage = 0;
let totalPages = 0;
let cachedPages = {};
let loadingAnimationInterval;
let userAddress = null;
let registeredName = null;

const ANIMATION_SPEED = 10; // ms between each step
const HIGHLIGHT_COLOR = '#8A2BE2'; // Purple
const HIGHLIGHT_WIDTH = 64; // Number of runes to highlight at once

function initializeRunes() {
    const leftRunes = document.getElementById('leftRunes');
    const rightRunes = document.getElementById('rightRunes');

    if (leftRunes && rightRunes) {
        leftRunes.innerHTML = Array.from(leftRunes.textContent).map(rune => `<tspan class="rune">${rune}</tspan>`).join('');
        rightRunes.innerHTML = Array.from(rightRunes.textContent).map(rune => `<tspan class="rune">${rune}</tspan>`).join('');
        console.log("Runes initialized");
    }
}

let isAnimating = false;
let animationFrame = null;

function startLoadingAnimation() {
    if (isAnimating) return; // Don't start a new animation if one is already running

    console.log("startLoadingAnimation called");
    const leftRunes = document.querySelectorAll('#leftRunes .rune');
    const rightRunes = document.querySelectorAll('#rightRunes .rune');

    console.log(`Left runes: ${leftRunes.length}, Right runes: ${rightRunes.length}`);

    if (leftRunes.length === 0 || rightRunes.length === 0) {
        console.log("Runes not found, skipping animation");
        return;
    }

    console.log("Starting loading animation");

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
    console.log("Stopping loading animation");
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

async function fetchCurrentPage() {
    try {
        startLoadingAnimation(); // Start animation immediately
        totalPages = await readOnlyContract.currentPage();
        await updatePage(totalPages);
    } catch (error) {
        console.error("Failed to fetch current page:", error);
        document.getElementById('storyContent').textContent = `Failed to fetch current page: ${error.message}`;
    } finally {
        stopLoadingAnimation(); // Ensure animation stops even if there's an error
    }
}

async function updatePage(pageNumber) {
    startLoadingAnimation(); // Start animation for page update
    try {
        pageNumber = Math.max(0, Math.min(pageNumber, totalPages));

        let pageContent;
        if (cachedPages[pageNumber]) {
            pageContent = cachedPages[pageNumber];
        } else {
            pageContent = await readOnlyContract.pageScript(pageNumber);
            cachedPages[pageNumber] = pageContent;
        }

        console.log("Page content (last 50 characters):", pageContent.slice(-50));
        console.log("Page content length:", pageContent.length);
        // Add 512 blank spaces to the end of the content
        pageContent = pageContent + '\u00A0'.repeat(512);

        document.getElementById('storyContent').textContent = pageContent;
        currentPage = pageNumber;
        document.getElementById('pageNumber').textContent = `PAGE ${pageNumber}`;

        document.getElementById('prevPage').style.opacity = (pageNumber === 0) ? '0.5' : '1';
        document.getElementById('nextPage').style.opacity = (pageNumber >= totalPages) ? '0.5' : '1';
    } catch (error) {
        console.error("Failed to fetch page:", error);
        document.getElementById('storyContent').textContent = `Failed to fetch page: ${error.message}`;
    } finally {
        stopLoadingAnimation(); // Ensure animation stops even if there's an error
    }
}

function loadEthers() {
    return new Promise((resolve, reject) => {
        if (typeof ethers !== 'undefined') {
            resolve();
        } else {
            const script = document.createElement('script');
            script.src = 'https://cdn.ethers.io/lib/ethers-5.0.umd.min.js';
            script.onload = resolve;
            script.onerror = () => {
                console.log('CDN load failed, trying local fallback');
                const localScript = document.createElement('script');
                localScript.src = 'ethers-5.0.min.js'; // Local fallback
                localScript.onload = resolve;
                localScript.onerror = reject;
                document.body.appendChild(localScript);
            };
            document.body.appendChild(script);
        }
    });
}

async function initializeApp() {
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

            // Initial connection attempt
            await connectWallet();
        } else {
            console.log("No web3 wallet detected. Read-only mode activated.");
            updateWalletStatus();
        }

        initializeRunes();
        await fetchCurrentPage();
        setupContributionPopup();
    } catch (error) {
        console.error("Failed to initialize app:", error);
        showCustomAlert(`Failed to initialize app: ${error.message}`);
    } finally {
        stopLoadingAnimation();
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
        console.log(`Left runes HTML: ${leftRunes.outerHTML}`);
        console.log(`Right runes HTML: ${rightRunes.outerHTML}`);
        console.log(`Left runes: ${leftRunes.querySelectorAll('.rune').length}, Right runes: ${rightRunes.querySelectorAll('.rune').length}`);
    } else {
        console.error("Rune containers not found in the DOM");
    }
}

function checkRuneVisibility() {
    const leftRunes = document.querySelectorAll('#leftRunes .rune');
    const rightRunes = document.querySelectorAll('#rightRunes .rune');

    console.log(`Checking rune visibility:`);
    console.log(`Left runes visible: ${leftRunes.length}, First left rune bounding box:`, leftRunes[0]?.getBoundingClientRect());
    console.log(`Right runes visible: ${rightRunes.length}, First right rune bounding box:`, rightRunes[0]?.getBoundingClientRect());
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
            updateWalletStatus();
            return true;
        } catch (error) {
            console.error("Failed to connect wallet:", error);
            updateWalletStatus();
            return false;
        }
    } else {
        alert("Please install MetaMask to connect a wallet!");
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

function updateWalletStatus() {
    const walletStatus = document.getElementById('walletStatus');
    const nameRegistration = document.getElementById('nameRegistration');
    const walletButton = document.getElementById('walletButton');

    if (!userAddress) {
        walletStatus.textContent = 'No Connected Wallet';
        nameRegistration.style.display = 'none';
        walletButton.textContent = 'Connect';
    } else if (registeredName) {
        walletStatus.textContent = `Connected Wallet: ${registeredName}`;
        nameRegistration.style.display = 'none';
        walletButton.textContent = 'Disconnect';
    } else {
        walletStatus.textContent = `Connected Wallet: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
        nameRegistration.style.display = 'flex';
        walletButton.textContent = 'Disconnect';
    }
}

async function registerName() {
    if (!userAddress) {
        showCustomAlert("Please connect your wallet first.");
        return;
    }

    const nameInput = document.getElementById('nameInput');
    const name = nameInput.value.trim();

    if (name.length === 0) {
        showCustomAlert("Please enter a name to register.");
        return;
    }

    try {
        startLoadingAnimation();
        const tx = await contract.register(name);
        await tx.wait();
        registeredName = name;
        updateWalletStatus();
        showCustomAlert("Name registered successfully!");
        nameInput.value = '';
    } catch (error) {
        console.error("Failed to register name:", error);
        showCustomAlert(`Failed to register name: ${error.message}`);
    } finally {
        stopLoadingAnimation();
    }
}

async function contribute() {
    if (!checkWallet()) return;
    if (!await connectWallet()) return;

    const contribution = document.getElementById('contributionInput').value;
    if (contribution.length === 0 || contribution.length > 256) {
        showCustomAlert("Contribution must be between 1 and 256 characters.");
        return;
    }

    try {
        // Check if user is on the correct network
        const rpcNetworkId = await getRPCNetworkId();
        const userNetworkId = await getUserNetworkId();

        if (rpcNetworkId !== userNetworkId) {
            const confirmed = await showCustomAlert(`Please switch to Scroll Mainnet. Expected network ID: ${rpcNetworkId}, Your current network ID: ${userNetworkId}. Would you like to switch networks?`);
            if (confirmed) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: `0x${rpcNetworkId.toString(16)}` }],
                    });
                } catch (switchError) {
                    // This error code indicates that the chain has not been added to MetaMask.
                    if (switchError.code === 4902) {
                        showCustomAlert("This network is not available in your MetaMask, please add it manually.");
                    } else {
                        showCustomAlert("Failed to switch networks. " + switchError.message);
                    }
                    return;
                }
            } else {
                return;
            }
        }

        const tx = await contract.contribute(contribution, { value: ethers.utils.parseEther("0.0002") });
        await tx.wait();
        showCustomAlert("Contribution sent successfully!");
        document.getElementById('contributionInput').value = '';
        closePopup();
        fetchCurrentPage();
    } catch (error) {
        console.error("Failed to send contribution:", error);
        showCustomAlert(`Failed to send contribution: ${error.message}`);
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
    const popup = document.getElementById('contributionPopup');
    const contributeButton = document.getElementById('contributeButton');
    const closePopupButton = document.getElementById('closePopup');
    const submitContributionButton = document.getElementById('submitContribution');
    const registerNameButton = document.getElementById('registerName');

    contributeButton.addEventListener('click', () => {
        clearAlert();
        popup.style.display = 'flex';
    });

    closePopupButton.addEventListener('click', closePopup);
    submitContributionButton.addEventListener('click', contribute);
    registerNameButton.addEventListener('click', registerName);

    // Add button-text class to popup buttons
    submitContributionButton.classList.add('button-text');
    closePopupButton.classList.add('button-text');
    registerNameButton.classList.add('button-text');
}

function closePopup() {
    document.getElementById('contributionPopup').style.display = 'none';
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

function clearAlert() {
    const alertArea = document.getElementById('alertArea');
    alertArea.textContent = '';
    alertArea.style.display = 'none';
}

function showCustomAlert(message, duration = 5000) {
    const alertArea = document.getElementById('alertArea');
    alertArea.textContent = message;
    alertArea.style.display = 'block';
    alertArea.style.opacity = '1';
    alertArea.style.transition = 'opacity 0.5s ease-in-out';

    setTimeout(() => {
        alertArea.style.opacity = '0';
        setTimeout(() => {
            alertArea.style.display = 'none';
        }, 500); // Wait for fade out animation to complete
    }, duration);
}

function checkWallet() {
    if (typeof window.ethereum === 'undefined' || !contract) {
        showCustomAlert("Please install and connect a Web3 wallet like MetaMask to perform this action!");
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

document.getElementById('prevPage').addEventListener('click', () => updatePage(currentPage - 1));
document.getElementById('nextPage').addEventListener('click', () => updatePage(currentPage + 1));
document.getElementById('walletButton').addEventListener('click', handleWalletButtonClick);

window.addEventListener('load', initializeApp);

