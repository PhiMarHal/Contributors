
let contract;
let readOnlyContract;
let currentPage = 0;
let totalPages = 0;

async function initializeApp() {
    try {
        const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
        readOnlyContract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONFIG.CONTRACT_ABI, provider);

        if (typeof window.ethereum !== 'undefined') {
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = web3Provider.getSigner();
            contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONFIG.CONTRACT_ABI, signer);
        }

        await fetchCurrentPage();
        setupContributionPopup();
    } catch (error) {
        console.error("Failed to initialize app:", error);
        document.getElementById('storyContent').textContent = `Failed to initialize app: ${error.message}`;
    }
}

async function fetchCurrentPage() {
    try {
        totalPages = await readOnlyContract.currentPage();
        await updatePage(totalPages);
    } catch (error) {
        console.error("Failed to fetch current page:", error);
        document.getElementById('storyContent').textContent = `Failed to fetch current page: ${error.message}`;
    }
}

async function updatePage(pageNumber) {
    try {
        pageNumber = Math.max(0, Math.min(pageNumber, totalPages));
        const pageContent = await readOnlyContract.pageScript(pageNumber);
        document.getElementById('storyContent').textContent = pageContent.trim();
        currentPage = pageNumber;
        document.getElementById('pageNumber').textContent = `PAGE ${pageNumber}`;

        document.getElementById('prevPage').style.opacity = (pageNumber === 0) ? '0.5' : '1';
        document.getElementById('nextPage').style.opacity = (pageNumber >= totalPages) ? '0.5' : '1';
    } catch (error) {
        console.error("Failed to fetch page:", error);
        document.getElementById('storyContent').textContent = `Failed to fetch page: ${error.message}`;
    }
}

async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = web3Provider.getSigner();
            contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONFIG.CONTRACT_ABI, signer);
            return true;
        } catch (error) {
            console.error("Failed to connect wallet:", error);
            return false;
        }
    } else {
        alert("Please install MetaMask to contribute!");
        return false;
    }
}

async function contribute() {
    if (!await connectWallet()) return;

    const contribution = document.getElementById('contributionInput').value;
    if (contribution.length === 0 || contribution.length > 256) {
        alert("Contribution must be between 1 and 256 characters.");
        return;
    }

    try {
        const tx = await contract.contribute(contribution, { value: ethers.utils.parseEther("0.0002") });
        await tx.wait();
        alert("Contribution sent successfully!");
        document.getElementById('contributionInput').value = '';
        closePopup();
        fetchCurrentPage();
    } catch (error) {
        console.error("Failed to send contribution:", error);
        alert(`Failed to send contribution: ${error.message}`);
    }
}

function setupContributionPopup() {
    const popup = document.getElementById('contributionPopup');
    const contributeButton = document.getElementById('contributeButton');
    const closePopupButton = document.getElementById('closePopup');
    const submitContributionButton = document.getElementById('submitContribution');

    contributeButton.addEventListener('click', () => {
        popup.style.display = 'flex';
    });

    closePopupButton.addEventListener('click', closePopup);

    submitContributionButton.addEventListener('click', contribute);
}

function closePopup() {
    document.getElementById('contributionPopup').style.display = 'none';
}

document.getElementById('prevPage').addEventListener('click', () => updatePage(currentPage - 1));
document.getElementById('nextPage').addEventListener('click', () => updatePage(currentPage + 1));

window.addEventListener('load', initializeApp);