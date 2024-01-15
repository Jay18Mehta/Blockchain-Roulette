// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";

error roulette__BalanceOutsideBound();
error roulette__NotEnoughMoneyToPlay();
error roulette__WaitForRouletteToCompleteProcess();
error roulette__TransferFailed();
error roulette__NotOwner();
error roulette__notEnoughMoneyInContract();

contract Roulette is VRFConsumerBaseV2 {

    /**Enum */
    enum Roulette_State{
        play,wait
    }

    modifier onlyOwner {
        if(msg.sender != i_owner){
            revert roulette__NotOwner();
        }
        _;
    }

    //chainlink vrf variables
    VRFCoordinatorV2Interface public immutable i_vrfCoordinator;
    uint64 private immutable i_subscriptionId;
    bytes32 private immutable i_gasLane;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    // VRF helpers
    mapping(uint256=>address) public s_requestIdToSender;
    
    //contract variabless
    address private immutable i_owner;
    int256 private s_contractFund;

    //user variables
    struct User {
        int256 ethAmount;
        uint256 rouletteAnswer;
        uint256[] straightUpBets;
        string[] outsideBets;
        Roulette_State roulette_State;
    }
    mapping(address => User) private s_userMapping;
    uint256 private immutable i_minEthBalance; // 0.01 
    uint256 private immutable i_maxEthBalance; //0.1

    //roulette variables
    uint16 private constant TOTAL_POSSIBLE_OUTPUTS = 38;
    uint256 private immutable i_straightUpBetsValue;
    uint256 private immutable i_outsideBetsValue;
    bytes32 private constant ONE_TO_TWELVE = keccak256(abi.encodePacked("ONE_TO_TWELVE"));
    bytes32 private constant THIRTEEN_TO_TWENTYFOUR = keccak256(abi.encodePacked("THIRTEEN_TO_TWENTYFOUR"));
    bytes32 private constant TWENTYFIVE_TO_THIRTYSIX = keccak256(abi.encodePacked("TWENTYFIVE_TO_THIRTYSIX"));
    bytes32 private constant ONE_TO_EIGHTEEN = keccak256(abi.encodePacked("ONE_TO_EIGHTEEN"));
    bytes32 private constant NINETEEN_TO_THIRTYSIX = keccak256(abi.encodePacked("NINETEEN_TO_THIRTYSIX"));
    bytes32 private constant FIRST_COLOUMN = keccak256(abi.encodePacked("FIRST_COLOUMN"));
    bytes32 private constant SECOND_COLOUMN = keccak256(abi.encodePacked("SECOND_COLOUMN"));
    bytes32 private constant THIRD_COLOUMN = keccak256(abi.encodePacked("THIRD_COLOUMN"));
    bytes32 private constant ODD = keccak256(abi.encodePacked("ODD"));
    bytes32 private constant EVEN = keccak256(abi.encodePacked("EVEN"));
    bytes32 private constant RED = keccak256(abi.encodePacked("RED"));
    bytes32 private constant BLACK = keccak256(abi.encodePacked("BLACK"));
    bytes32[36] private s_numberColour = [RED,BLACK,RED,BLACK,RED,BLACK,RED,BLACK,RED,BLACK,BLACK,RED,BLACK,RED,BLACK,RED,BLACK,RED,RED,BLACK,RED,BLACK,RED,BLACK,RED,BLACK,RED,BLACK,BLACK,RED,BLACK,RED,BLACK,RED,BLACK,RED];

    //events
    event winAmountEvent(int256 indexed winAmount);
    event numberPicked(uint256 indexed number);
    event userRequestId(uint256 indexed requestId);

    constructor(uint256 _minEthBalance,uint256 _maxEthBalance,address _vrfCoordinator,uint64 subscriptionId,bytes32 gasLane,uint32 callbackGasLimit,uint256 straightUpBetsValue,uint256 outsideBetsValue) VRFConsumerBaseV2(_vrfCoordinator){
        i_minEthBalance = _minEthBalance;
        i_maxEthBalance = _maxEthBalance;
        i_vrfCoordinator=VRFCoordinatorV2Interface(_vrfCoordinator);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        i_straightUpBetsValue = straightUpBetsValue;
        i_outsideBetsValue = outsideBetsValue;
        i_owner=msg.sender;
    }

    function fundContract() public payable onlyOwner {
        s_contractFund+=int256(msg.value);
    }    

    function addBalance() public payable{
        if(!(i_minEthBalance<=msg.value+uint256(s_userMapping[msg.sender].ethAmount) && msg.value+uint256(s_userMapping[msg.sender].ethAmount)<=i_maxEthBalance)){
            revert roulette__BalanceOutsideBound();
        }
        s_userMapping[msg.sender].ethAmount +=int256(msg.value);
    }

    function requestRandomWords(uint256[] memory straightUpBets,string[] memory outsideBets) public returns(uint256 requestId){
        User memory user = s_userMapping[msg.sender];
        if(user.roulette_State == Roulette_State.wait){
            revert roulette__WaitForRouletteToCompleteProcess();
        }
        int256 betAmount = int256(straightUpBets.length*i_straightUpBetsValue+outsideBets.length*i_outsideBetsValue);
        if(user.ethAmount < betAmount){
            revert roulette__NotEnoughMoneyToPlay();
        }
        if(s_contractFund <=0){
            revert roulette__notEnoughMoneyInContract();
        }
        user.roulette_State = Roulette_State.wait;
        user.straightUpBets = straightUpBets;
        user.outsideBets = outsideBets;
        requestId=i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        s_userMapping[msg.sender] = user;

        s_requestIdToSender[requestId] = msg.sender;

        emit userRequestId(requestId);
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override{
        address userAddress = s_requestIdToSender[requestId];
        User memory user = s_userMapping[userAddress];
        uint256[] memory straightUpBets = user.straightUpBets;
        string[] memory outsideBets = user.outsideBets;

        uint256 rouletteAnswer = randomWords[0]%TOTAL_POSSIBLE_OUTPUTS;
        
        int256 winAmount = calculateWinAmount(rouletteAnswer,straightUpBets,outsideBets);

        user.rouletteAnswer = rouletteAnswer;
        user.ethAmount+=winAmount;
        user.roulette_State = Roulette_State.play;
        s_userMapping[userAddress] = user;
        s_contractFund -= winAmount;

        emit numberPicked(rouletteAnswer);
    }

    function calculateWinAmount(uint256 rouletteAnswer,uint256[] memory straightUpBets,string[] memory outsideBets)public returns(int256){
        int256 winAmount = -1*int256(straightUpBets.length*i_straightUpBetsValue+outsideBets.length*i_outsideBetsValue);

        for(uint256 i = 0;i<straightUpBets.length;i++){  //considering 37 = 00
            if(straightUpBets[i] == rouletteAnswer){
                winAmount+=int256(36*i_straightUpBetsValue);
            }
        }

        if(!(rouletteAnswer==0 || rouletteAnswer==37)){
            for(uint256 i= 0;i<outsideBets.length;i++){
                bytes32 bet = keccak256(abi.encodePacked(outsideBets[i]));
                if(bet == ONE_TO_TWELVE && rouletteAnswer<=12){
                    winAmount+=int256(3*i_outsideBetsValue);
                }
                else if(bet == THIRTEEN_TO_TWENTYFOUR && rouletteAnswer>=13 && rouletteAnswer<=24){
                    winAmount+=int256(3*i_outsideBetsValue);
                }
                else if(bet == TWENTYFIVE_TO_THIRTYSIX && rouletteAnswer>=25){
                    winAmount+=int256(3*i_outsideBetsValue);
                }
                else if(bet == ONE_TO_EIGHTEEN && rouletteAnswer<=18){
                    winAmount+=int256(2*i_outsideBetsValue);
                }
                else if(bet == NINETEEN_TO_THIRTYSIX && rouletteAnswer>=19){
                    winAmount+=int256(2*i_outsideBetsValue);
                }
                else if(bet == FIRST_COLOUMN && rouletteAnswer%3==1){
                    winAmount+=int256(3*i_outsideBetsValue);
                }
                else if(bet == SECOND_COLOUMN && rouletteAnswer%3==2){
                    winAmount+=int256(3*i_outsideBetsValue);
                }
                else if(bet == THIRD_COLOUMN && rouletteAnswer%3==0){
                    winAmount+=int256(3*i_outsideBetsValue);
                }
                else if(bet == ODD && rouletteAnswer%2==1){
                    winAmount+=int256(2*i_outsideBetsValue);
                }
                else if(bet == EVEN && rouletteAnswer%2==0){
                    winAmount+=int256(2*i_outsideBetsValue);
                } 
                else if(bet == RED && bet == s_numberColour[rouletteAnswer-1]){
                    winAmount+=int256(2*i_outsideBetsValue);
                }
                else if(bet == BLACK && bet == s_numberColour[rouletteAnswer-1]){
                    winAmount+=int256(2*i_outsideBetsValue);
                } 
                else if(bet != ODD && bet!=EVEN && bet != RED && bet!=BLACK && bet!=ONE_TO_TWELVE && bet!=THIRTEEN_TO_TWENTYFOUR && bet!=TWENTYFIVE_TO_THIRTYSIX && bet!=ONE_TO_EIGHTEEN && bet!=NINETEEN_TO_THIRTYSIX && bet!=FIRST_COLOUMN && bet!=SECOND_COLOUMN && bet!=THIRD_COLOUMN){  //error hanndling
                    winAmount+=int256(i_outsideBetsValue);
                }
            }
        }
        emit winAmountEvent(winAmount);
        return winAmount;
    }

    function withdrawBalance() public {
        User memory user = s_userMapping[msg.sender];
        if(0> s_contractFund){
            revert roulette__notEnoughMoneyInContract();
        }
        (bool callSuccess, ) = /*(user.payableAddress)*/payable(msg.sender).call{value: uint256(user.ethAmount)}("");
        if (!callSuccess) {
            revert roulette__TransferFailed();
        }
        s_userMapping[msg.sender].ethAmount -= user.ethAmount;
    }

    function withdrawContractFund(uint256 funds) public onlyOwner {
        if(s_contractFund<int256(funds)){
            revert roulette__notEnoughMoneyInContract();
        }
        (bool callSuccess, ) = payable(i_owner).call{value: funds}("");
        if (!callSuccess) {
            revert roulette__TransferFailed();
        }
        s_contractFund-=int256(funds);
    }

    function getGasLane() public view returns(bytes32){
        return i_gasLane;
    }
    function getCallBackGasLimit() public view returns(uint32){
        return i_callbackGasLimit;
    }
    function getNumWords() public pure returns(uint32){
        return NUM_WORDS;
    }
     function getMinEthBalance() public view returns(uint256){
        return i_minEthBalance;
    }
    function getMaxEthBalance() public view returns(uint256){
        return i_maxEthBalance;
    }
    function getContractOwner() public view returns(address){
        return i_owner;
    }
    function getContractFund() public view returns(int256){
        return s_contractFund;
    }
    function getUserMapping(address user) public view returns(User memory){
        return s_userMapping[user];
    }
    function getStraightUpBetsValue() public view returns(uint256){
        return i_straightUpBetsValue;
    }
    function getOutsideBetsValue() public view returns(uint256){
        return i_outsideBetsValue;
    }

    fallback() external payable {
        if(msg.sender != i_owner){
            addBalance();
        }
    }

    receive() external payable {
        if(msg.sender != i_owner){
            addBalance();
        }
    }
}
