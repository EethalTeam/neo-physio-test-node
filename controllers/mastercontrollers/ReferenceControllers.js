const mongoose = require("mongoose");
const Reference = require("../../model/masterModels/Reference");

// create Reference
exports.createReference = async (req, res) => {
  try {
    const {
      sourceName,
      commissionCategory,
      commissionType,
      CommissionPercentage,
      commissionAmount,
    } = req.body;

    // // Check for duplicates (if needed)
    // const exitingReference = await Reference.findOne({
    //     $or:[

    //         {sourceCode}
    //     ]
    // })

    // if(exitingReference){
    //     return   res.status(400).json({ message: 'Reference with this code or name already exists' });

    const lastReference = await Reference.findOne(
      {},
      {},
      { sort: { createdAt: -1 } },
    );
    let nextReferenceNumber = 1;

    if (lastReference && lastReference.sourceCode) {
      const lastNumber = parseInt(
        lastReference.sourceCode.replace("REFERENCE", ""),
      );
      nextReferenceNumber = isNaN(lastNumber) ? 1 : lastNumber + 1;
    }

    const sourceCode = `REFERENCE${String(nextReferenceNumber).padStart(
      3,
      "0",
    )}`;

    const Refer = new Reference({
      sourceCode,
      sourceName,
      commissionCategory,
      commissionType,
      CommissionPercentage,
      commissionAmount,
    });
    await Refer.save();
    res
      .status(200)
      .json({ message: "References Create successfully", data: Refer._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getAllReferences

exports.getAllReference = async (req, res) => {
  try {
    const Refer = await Reference.find();
    res.status(200).json(Refer);
    if (!Refer) {
      return res.status(400).json({ message: "References is not find" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//get single Reeference by Name

exports.getSingleReference = async (req, res) => {
  try {
    const Refer = await Reference.findOne({ sourceName: req.body.sourceName });
    if (!Refer) {
      return res.status(400).json({ message: "References is not find" });
    }
    res.status(200).json(Refer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//update References

exports.updateReferences = async (req, res) => {
  try {
    const {
      _id,
      sourceCode,
      sourceName,
      commissionCategory,
      commissionType,
      CommissionPercentage,
      commissionAmount,
    } = req.body;

    const Refer = await Reference.findByIdAndUpdate(
      _id,
      {
        $set: {
          sourceCode,
          sourceName,
          commissionCategory,
          commissionType,
          CommissionPercentage,
          commissionAmount,
        },
      },
      { new: true, runValidators: true },
    );

    if (!Refer) {
      return res.status(400).json({ message: "References is not update" });
    }
    res.status(200).json(Refer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//delete References

exports.deleteReferences = async (req, res) => {
  try {
    const { _id } = req.body;
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    const Refer = await Reference.findByIdAndDelete(_id);
    if (!Refer) {
      res.status(400).json({ message: "References is unable to delete" });
    }
    res.status(200).json({ message: "References delete successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
