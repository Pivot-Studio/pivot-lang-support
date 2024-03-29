"""
for docs, see:
https://lldb.llvm.org/use/variable.html
"""

from __future__ import print_function, division
import lldb


class PLUnionProvider(object):

    def __init__(self, valobj:lldb.SBValue, dict={}):
        self.valobj = valobj

    def update(self):
        return True

    def has_children(self):
        return True

    def num_children(self):
        return 1

    def get_child_at_index(self, index):
        # if index > 0:
        #     return None
        tag = self.valobj.GetChildAtIndex(0).GetValueAsUnsigned(0)
        child = self.valobj.GetChildAtIndex(1).GetChildAtIndex(tag)
        return child

    def get_child_index(self, name):
        return 0



# class PLHashTableProvider(object):

#     def __init__(self, valobj:lldb.SBValue, dict={}):
#         self.valobj = valobj

#     def update(self):
#         return True

#     def has_children(self):
#         return True

#     def num_children(self):
#         return self.valobj.GetChildAtIndex(3).GetValueAsUnsigned(0)

#     def get_child_at_index(self, index):
#         # if index > 0:
#         #     return None
#         # tag = self.valobj.GetChildAtIndex(0).GetValueAsUnsigned(0)
#         # child = self.valobj.GetChildAtIndex(1).GetChildAtIndex(tag)

#         return self.valobj.GetChildAtIndex(1)

#     def get_child_index(self, name):
#         return 0


class PLArrayProvider(object):

    def __init__(self, valobj:lldb.SBValue, dict={}):
        self.valobj = valobj

    def update(self):
        return True

    def has_children(self):
        return True

    def num_children(self):
        return self.valobj.GetChildAtIndex(2).GetValueAsUnsigned(0)

    def get_child_at_index(self, index):
        arr = self.valobj.GetChildMemberWithName('_arr')
        
        if index == 0:
            
            return arr.CreateChildAtOffset("[0]", 0, arr.type.GetPointeeType())
        
        """
        lldb will auto dereference the pointer before get child if the pointee type is not a primitive
        so we may not use `GetChildAtIndex` here to get the array element
        """
        bytes = lldb.SBType(self.valobj.GetChildMemberWithName('_arr').type.GetPointeeType()).GetByteSize()
        return arr.CreateChildAtOffset("[{}]".format(index), index*bytes, arr.type.GetPointeeType())

    def get_child_index(self, name):
        return -1


def get_summary(valobj:lldb.SBValue,internal_dict,options):
    if "NULL" in valobj.__str__():
        return '<null>'
    s = '{}(Union type)'.format(valobj.type.name.split("::")[1])
    return s


def __lldb_init_module(debugger, dict):
    debugger.HandleCommand('type summary add  -F pl.get_summary -x union::[:<.>,\|]*')
    # debugger.HandleCommand('type summary add  --summary-string "HashTable" -x HashTable[:<.>,\|]*')
    # debugger.HandleCommand('type synthetic add --python-class pl.PLHashTableProvider -x HashTable[:<.>,\|]*')
    debugger.HandleCommand('type synthetic add --python-class pl.PLArrayProvider -x \[.+\]*')
    debugger.HandleCommand('type synthetic add --python-class pl.PLUnionProvider -x union::[:<.>,\|]*')


